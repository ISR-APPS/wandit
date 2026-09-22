/**
 * Answers every panel of the Cloud tab (WANDIT-187) behind
 * `/api/v2/projects/:id/cloud/*`. `CloudController` is the only caller.
 * Reads `projects` and `app_backends` through repositories, calls the
 * Supabase Management API and the project Storage API through
 * `SupabaseManagementClient`, and writes `audit_events` rows for SQL
 * writes and object deletes. No platform key or service-role key ever
 * reaches the browser.
 */
import { createHash } from "node:crypto";

import {
	BadRequestException,
	ConflictException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import {
	CLOUD_JOB_RUNS_PER_JOB,
	CLOUD_LOGS_MAX_WINDOW_MS,
	CLOUD_LOGS_PAGE_SIZE,
	CLOUD_OBJECTS_PAGE_SIZE,
	CLOUD_SIGNED_URL_TTL_SECONDS,
	CLOUD_SIGNUP_DAYS,
	CLOUD_SQL_ROW_LIMIT,
	type CloudAuthUsersQuery,
	type CloudAuthUsersResponse,
	type CloudBackendResponse,
	type CloudBucketsResponse,
	type CloudDeleteObjectsBody,
	type CloudDeleteObjectsResponse,
	type CloudFunctionsResponse,
	type CloudJobsResponse,
	type CloudLogLevel,
	type CloudLogSource,
	type CloudLogsQuery,
	type CloudLogsResponse,
	type CloudObjectsQuery,
	type CloudObjectsResponse,
	type CloudRowsQuery,
	type CloudRowsResponse,
	type CloudSignupsResponse,
	type CloudSqlBody,
	type CloudSqlResponse,
	type CloudTable,
	type CloudTablesQuery,
	type CloudTablesResponse,
	type CloudUploadUrlBody,
	type CloudUploadUrlResponse,
	classifySql,
	cloudAuthUserRowSchema,
	cloudCountRowSchema,
	cloudFunctionCountRowSchema,
	cloudInstalledRowSchema,
	cloudJobRowSchema,
	cloudLogRowSchema,
	cloudPageRowSchema,
	cloudSignupRowSchema,
	cloudTableColumnRowSchema,
	sqlRowSchema,
} from "@wandit/contracts";
import type { z } from "zod";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	type AppBackendRow,
	AppBackendsRepository,
} from "../../infrastructure/persistence/app-backends.repository";
import {
	AppCommitsRepository,
	type ScopedAppProject,
} from "../../infrastructure/persistence/app-commits.repository";
import { AuditEventsRepository } from "../../infrastructure/persistence/audit-events.repository";
import {
	type BackendRef,
	type StorageRef,
	SUPABASE_MANAGEMENT_CLIENT,
	type SupabaseManagementClient,
	SupabaseManagementError,
	SupabaseRateLimitedError,
} from "../../infrastructure/supabase/supabase-management.client";
import { BackendsService } from "./backends.service";

// 30 s: a panel refresh inside this window reads the last answer. The
// issue allows 30 to 60 s; the short end keeps counts close to Studio.
const CLOUD_CACHE_TTL_MS = 30_000;

/**
 * 429 `RATE_LIMITED` from the per-ref upstream bucket. `RetryAfterInterceptor`
 * in the controller copies `retryAfterSeconds` into the `Retry-After` header.
 */
export class CloudRateLimitedException extends HttpException {
	constructor(
		/** Whole seconds until the bucket accepts a call again; at least 1. */
		readonly retryAfterSeconds: number,
	) {
		super(
			{ code: "RATE_LIMITED", message: "Rate limit exceeded" },
			HttpStatus.TOO_MANY_REQUESTS,
		);
	}
}

/** An `active` backend row with its ref; the scope of every upstream call. */
type ActiveBackend = BackendRef & {
	/** `app_backends.id`; the audit rows point at it. */
	id: string;
};

type CacheEntry<T> = {
	/** Unix milliseconds after which the entry is stale. */
	expiresAt: number;
	value: T;
};

// The columns of every `public` base table with the live-row estimate.
// float8 keeps a count above 2^31 in a JSON number.
const TABLES_SQL = `
select c.table_name, c.column_name, c.data_type, c.is_nullable = 'YES' as is_nullable,
  c.column_default, coalesce(s.n_live_tup, 0)::float8 as row_estimate
from information_schema.columns c
join information_schema.tables t
  on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
left join pg_stat_user_tables s on s.schemaname = c.table_schema and s.relname = c.table_name
where c.table_schema = 'public'
order by c.table_name, c.ordinal_position`;

// One row per UTC day of the last CLOUD_SIGNUP_DAYS days, zero days included.
const SIGNUPS_SQL = `
select to_char(d, 'YYYY-MM-DD') as date, count(u.id)::float8 as count
from generate_series(
  date_trunc('day', now() at time zone 'UTC') - interval '${CLOUD_SIGNUP_DAYS - 1} days',
  date_trunc('day', now() at time zone 'UTC'), interval '1 day') as d
left join auth.users u on date_trunc('day', u.created_at at time zone 'UTC') = d
group by d order by d`;

// `to_regclass` answers null when pg_cron is not installed.
const CRON_INSTALLED_SQL =
	"select to_regclass('cron.job') is not null as installed";

// Every job with its last CLOUD_JOB_RUNS_PER_JOB runs as a JSON array.
const JOBS_SQL = `
select j.jobid::int as jobid, j.jobname, j.schedule, j.command, j.active,
  coalesce((select json_agg(r) from (
    select d.runid::int as runid, d.status, ${isoUtc("d.start_time")} as start_time,
      ${isoUtc("d.end_time")} as end_time, d.return_message
    from cron.job_run_details d where d.jobid = j.jobid
    order by d.start_time desc nulls last limit ${CLOUD_JOB_RUNS_PER_JOB}) r), '[]'::json) as runs
from cron.job j order by j.jobid`;

// Calls per function id over the window the request sets. UNVERIFIED:
// the `function_id` field of the unnested metadata (Studio uses it).
const FUNCTION_COUNTS_SQL =
	"select m.function_id as function_id, count(*) as count from function_edge_logs cross join unnest(metadata) as m group by m.function_id";

/** The log table of each source and how its level is read. UNVERIFIED shapes. */
const LOG_SOURCES: Record<
	CloudLogSource,
	{
		table: string;
		/** Unnest joins that expose the level column. */
		joins: string;
		/** Column the level filter and `level_value` read. */
		levelColumn: string;
		/** `status` for HTTP status codes; `severity` for Postgres severities. */
		kind: "status" | "severity";
	}
> = {
	api: {
		table: "edge_logs",
		joins:
			"cross join unnest(metadata) as m cross join unnest(m.response) as r",
		levelColumn: "r.status_code",
		kind: "status",
	},
	functions: {
		table: "function_edge_logs",
		joins:
			"cross join unnest(metadata) as m cross join unnest(m.response) as r",
		levelColumn: "r.status_code",
		kind: "status",
	},
	postgres: {
		table: "postgres_logs",
		joins: "cross join unnest(metadata) as m cross join unnest(m.parsed) as p",
		levelColumn: "p.error_severity",
		kind: "severity",
	},
};

// The SQL predicate of each level per level kind.
const LEVEL_FILTERS: Record<
	"status" | "severity",
	Record<CloudLogLevel, string>
> = {
	status: {
		info: "< 400",
		warning: "between 400 and 499",
		error: ">= 500",
	},
	severity: {
		info: "in ('LOG', 'INFO', 'NOTICE', 'DEBUG')",
		warning: "= 'WARNING'",
		error: "in ('ERROR', 'FATAL', 'PANIC')",
	},
};

/**
 * One method per Cloud route, in route order. Each method checks the
 * project scope first, then the backend state, then calls upstream.
 */
@Injectable()
export class CloudService {
	private readonly logger = new Logger(CloudService.name);
	// LIMIT: one cache per API process; two processes may answer different
	// counts for 30 s. Upgrade: Redis with the same TTL.
	private readonly tablesCache = new Map<string, CacheEntry<CloudTable[]>>();
	private readonly functionsCache = new Map<
		string,
		CacheEntry<CloudFunctionsResponse>
	>();
	private readonly signupsCache = new Map<
		string,
		CacheEntry<CloudSignupsResponse>
	>();

	constructor(
		// The Pick types keep each seam at the methods the service needs.
		// A spec passes a plain fake. Nest still injects by the class token.
		@Inject(AppCommitsRepository)
		private readonly appCommits: Pick<
			AppCommitsRepository,
			"findScopedProject"
		>,
		@Inject(AppBackendsRepository)
		private readonly backends: Pick<
			AppBackendsRepository,
			"findByProjectId" | "markRestoring"
		>,
		@Inject(BackendsService)
		private readonly provisioning: Pick<BackendsService, "provisionBackend">,
		@Inject(AuditEventsRepository)
		private readonly auditEvents: Pick<AuditEventsRepository, "insert">,
		@Inject(SUPABASE_MANAGEMENT_CLIENT)
		private readonly client: SupabaseManagementClient | null,
	) {}

	/** The backend row of the project; `status: "none"` without a row. */
	async getBackend(
		scope: ProjectScope,
		projectId: string,
	): Promise<CloudBackendResponse> {
		await this.requireProject(scope, projectId);
		return backendAnswer(await this.backends.findByProjectId(projectId));
	}

	/**
	 * Creates the backend when the project has none and answers the row.
	 * `provisionBackend` is idempotent: an existing row starts nothing.
	 */
	async ensureBackend(
		scope: ProjectScope,
		projectId: string,
		/** ISO country code of the request; the region pick reads it. */
		countryCode: string | null,
	): Promise<CloudBackendResponse> {
		const project = await this.requireProject(scope, projectId);
		const row = await this.provisioning.provisionBackend(projectId, {
			countryCode,
			organizationId: project.organizationId,
			userId: scope.userId,
		});
		if (row === null) {
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message:
					"SUPABASE_PLATFORM_TOKEN or SUPABASE_PLATFORM_ORG_ID is not set",
			});
		}
		return backendAnswer(row);
	}

	/**
	 * Wakes a paused backend: the upstream restore call, then the row moves
	 * `paused` to `restoring`. A row in another state answers as it is.
	 */
	async restoreBackend(
		scope: ProjectScope,
		projectId: string,
	): Promise<CloudBackendResponse> {
		await this.requireProject(scope, projectId);
		const row = await this.backends.findByProjectId(projectId);
		if (row === null || row.ref === null) {
			throw backendNotReady();
		}
		if (row.status !== "paused") {
			return backendAnswer(row);
		}
		const client = this.requireClient();
		const ref = row.ref;
		// The upstream call goes first: a failed call leaves the row `paused`,
		// so the user can click again.
		await this.upstream("api", () => client.restoreProject({ projectId, ref }));
		const moved = await this.backends.markRestoring(projectId);
		return backendAnswer(moved ? { ...row, status: "restoring" } : row);
	}

	/**
	 * The `public` tables with columns and live-row estimates. `exact` names
	 * one table to count with `count(*)`; an unknown name answers 400.
	 */
	async listTables(
		scope: ProjectScope,
		projectId: string,
		query: CloudTablesQuery,
	): Promise<CloudTablesResponse> {
		await this.requireProject(scope, projectId);
		const backend = await this.requireActiveBackend(projectId);
		const tables = await this.loadTables(backend);
		if (query.exact === undefined) {
			return { tables };
		}
		const exact = tables.find((table) => table.name === query.exact);
		if (exact === undefined) {
			throw invalidIdentifier(query.exact);
		}
		const counted = singleRow(
			await this.query(
				backend,
				`select count(*)::float8 as count from ${qualifiedTable(exact.name)}`,
				cloudCountRowSchema,
			),
		);
		const rowCount = Math.round(counted.count);
		return {
			tables: tables.map((table) =>
				table === exact ? { ...table, rowCount, rowCountExact: true } : table,
			),
		};
	}

	/**
	 * One page of one table. `table` and `sort` must be names the tables
	 * query listed; they enter the SQL quoted. Never raw user SQL.
	 */
	async listRows(
		scope: ProjectScope,
		projectId: string,
		table: string,
		query: CloudRowsQuery,
	): Promise<CloudRowsResponse> {
		await this.requireProject(scope, projectId);
		const backend = await this.requireActiveBackend(projectId);
		const tables = await this.loadTables(backend);
		const found = tables.find((candidate) => candidate.name === table);
		if (found === undefined) {
			throw invalidIdentifier(table);
		}
		const sort = query.sort ?? found.columns[0]?.name;
		if (
			sort === undefined ||
			!found.columns.some((column) => column.name === sort)
		) {
			throw invalidIdentifier(sort ?? table);
		}
		const offset = (query.page - 1) * query.pageSize;
		// LIMIT: `count(*)` runs on every page; slow above a few million
		// rows. Upgrade: answer the estimate when it is above a threshold.
		const sql = `with page as (select * from ${qualifiedTable(table)} order by ${quoteIdentifier(sort)} ${query.dir} limit ${query.pageSize} offset ${offset})
select (select count(*)::float8 from ${qualifiedTable(table)}) as total, coalesce((select json_agg(page) from page), '[]'::json) as items`;
		const page = singleRow(
			await this.query(backend, sql, cloudPageRowSchema(sqlRowSchema)),
		);
		return {
			items: page.items,
			page: query.page,
			pageSize: query.pageSize,
			total: Math.round(page.total),
		};
	}

	/**
	 * Runs one console statement. A read runs at once in a read-only
	 * transaction; a write needs `confirmWrite` and leaves an audit row
	 * with the query hash and the row count, never the text.
	 */
	async runSql(
		scope: ProjectScope,
		projectId: string,
		body: CloudSqlBody,
	): Promise<CloudSqlResponse> {
		await this.requireProject(scope, projectId);
		const backend = await this.requireActiveBackend(projectId);
		const kind = classifySql(body.query);
		// Product rule: the console asks once before any write runs.
		if (kind === "write" && !body.confirmWrite) {
			throw new ConflictException({
				code: "WRITE_NEEDS_CONFIRM",
				message: "This statement writes data; confirm to run it",
			});
		}
		const rows = await this.query(backend, body.query, sqlRowSchema, {
			readOnly: kind === "read",
		});
		// LIMIT: the upstream answers every row and the API keeps the first
		// 500. Upgrade: wrap a single select in a limited subquery.
		const truncated = rows.length > CLOUD_SQL_ROW_LIMIT;
		const kept = truncated ? rows.slice(0, CLOUD_SQL_ROW_LIMIT) : rows;
		if (kind === "write") {
			await this.auditEvents.insert({
				action: "cloud.sql_write",
				actorUserId: scope.userId,
				metadata: {
					queryHash: createHash("sha256").update(body.query).digest("hex"),
					rowCount: rows.length,
				},
				organizationId: organizationIdOf(scope),
				projectId,
				targetId: backend.id,
				targetType: "app_backend",
			});
		}
		return { kind, rowCount: kept.length, rows: kept, truncated };
	}

	/** One page of `auth.users`, newest first, with the sign-in provider. */
	async listAuthUsers(
		scope: ProjectScope,
		projectId: string,
		query: CloudAuthUsersQuery,
	): Promise<CloudAuthUsersResponse> {
		await this.requireProject(scope, projectId);
		const backend = await this.requireActiveBackend(projectId);
		const offset = (query.page - 1) * query.pageSize;
		const sql = `with page as (select u.id::text as id, u.email::text as email, u.phone::text as phone,
  ${isoUtc("u.created_at")} as created_at, ${isoUtc("u.last_sign_in_at")} as last_sign_in_at,
  u.raw_app_meta_data->>'provider' as provider
  from auth.users u order by u.created_at desc limit ${query.pageSize} offset ${offset})
select (select count(*)::float8 from auth.users) as total, coalesce((select json_agg(page) from page), '[]'::json) as items`;
		const page = singleRow(
			await this.query(
				backend,
				sql,
				cloudPageRowSchema(cloudAuthUserRowSchema),
			),
		);
		return {
			items: page.items.map((user) => ({
				createdAt: user.created_at,
				email: user.email,
				id: user.id,
				lastSignInAt: user.last_sign_in_at,
				phone: user.phone,
				provider: user.provider,
			})),
			page: query.page,
			pageSize: query.pageSize,
			total: Math.round(page.total),
		};
	}

	/** Sign-ups per UTC day for the last 30 days; cached 30 s. */
	async listSignups(
		scope: ProjectScope,
		projectId: string,
	): Promise<CloudSignupsResponse> {
		await this.requireProject(scope, projectId);
		const backend = await this.requireActiveBackend(projectId);
		return this.cached(this.signupsCache, backend.ref, async () => {
			const rows = await this.query(backend, SIGNUPS_SQL, cloudSignupRowSchema);
			return {
				days: rows.map((row) => ({
					count: Math.round(row.count),
					date: row.date,
				})),
			};
		});
	}

	/** The Storage buckets of the project. */
	async listBuckets(
		scope: ProjectScope,
		projectId: string,
	): Promise<CloudBucketsResponse> {
		await this.requireProject(scope, projectId);
		const backend = await this.requireActiveBackend(projectId);
		const client = this.requireClient();
		const buckets = await this.upstream("api", () =>
			client.listBuckets(backend),
		);
		return {
			buckets: buckets.map((bucket) => ({
				createdAt: bucket.created_at,
				id: bucket.id,
				name: bucket.name,
				public: bucket.public,
				updatedAt: bucket.updated_at,
			})),
		};
	}

	/**
	 * One page of objects under `prefix` with a signed download URL per
	 * file. The cursor is the offset of the next page.
	 */
	async listObjects(
		scope: ProjectScope,
		projectId: string,
		bucket: string,
		query: CloudObjectsQuery,
	): Promise<CloudObjectsResponse> {
		await this.requireProject(scope, projectId);
		const backend = await this.requireActiveBackend(projectId);
		const client = this.requireClient();
		const storage = await this.storageRef(backend);
		const offset = query.cursor === undefined ? 0 : Number(query.cursor);
		const prefix = query.prefix.replace(/\/+$/, "");
		const pathOf = (name: string) =>
			prefix === "" ? name : `${prefix}/${name}`;
		const objects = await this.upstream("api", () =>
			client.listObjects(storage, {
				bucket,
				limit: CLOUD_OBJECTS_PAGE_SIZE,
				offset,
				prefix,
			}),
		);
		// A folder has no id and gets no URL; the sign call takes files only.
		const filePaths = objects
			.filter((object) => object.id !== null)
			.map((object) => pathOf(object.name));
		const urls =
			filePaths.length === 0
				? new Map<string, string>()
				: await this.upstream("api", () =>
						client.signDownloadUrls(storage, {
							bucket,
							expiresInSeconds: CLOUD_SIGNED_URL_TTL_SECONDS,
							paths: filePaths,
						}),
					);
		return {
			items: objects.map((object) => {
				const path = pathOf(object.name);
				const isFolder = object.id === null;
				return {
					downloadUrl: isFolder ? null : (urls.get(path) ?? null),
					isFolder,
					mimeType: object.metadata?.mimetype ?? null,
					name: object.name,
					path,
					sizeBytes: object.metadata?.size ?? null,
					updatedAt: object.updated_at ?? null,
				};
			}),
			nextCursor:
				objects.length < CLOUD_OBJECTS_PAGE_SIZE
					? null
					: String(offset + CLOUD_OBJECTS_PAGE_SIZE),
		};
	}

	/** A signed upload URL for one path; the browser `PUT`s the file to it. */
	async createUploadUrl(
		scope: ProjectScope,
		projectId: string,
		bucket: string,
		body: CloudUploadUrlBody,
	): Promise<CloudUploadUrlResponse> {
		await this.requireProject(scope, projectId);
		const backend = await this.requireActiveBackend(projectId);
		const client = this.requireClient();
		const storage = await this.storageRef(backend);
		const uploadUrl = await this.upstream("api", () =>
			client.createUploadUrl(storage, { bucket, path: body.path }),
		);
		return { path: body.path, uploadUrl };
	}

	/** Deletes the listed objects and leaves an audit row with the counts. */
	async deleteObjects(
		scope: ProjectScope,
		projectId: string,
		bucket: string,
		body: CloudDeleteObjectsBody,
	): Promise<CloudDeleteObjectsResponse> {
		await this.requireProject(scope, projectId);
		const backend = await this.requireActiveBackend(projectId);
		const client = this.requireClient();
		const storage = await this.storageRef(backend);
		const deleted = await this.upstream("api", () =>
			client.deleteObjects(storage, { bucket, paths: body.paths }),
		);
		// The trail keeps the bucket and the counts: object names may be
		// user data.
		await this.auditEvents.insert({
			action: "cloud.objects_deleted",
			actorUserId: scope.userId,
			metadata: { bucket, deleted, requested: body.paths.length },
			organizationId: organizationIdOf(scope),
			projectId,
			targetId: backend.id,
			targetType: "app_backend",
		});
		return { deleted };
	}

	/**
	 * Log lines of one source inside a window of at most 24 hours, newest
	 * first. A wider window answers 400 `WINDOW_TOO_LARGE`.
	 */
	async queryLogs(
		scope: ProjectScope,
		projectId: string,
		query: CloudLogsQuery,
	): Promise<CloudLogsResponse> {
		await this.requireProject(scope, projectId);
		const windowMs = Date.parse(query.end) - Date.parse(query.start);
		if (windowMs <= 0) {
			throw new BadRequestException({
				code: "VALIDATION_ERROR",
				message: "end must be after start",
			});
		}
		if (windowMs > CLOUD_LOGS_MAX_WINDOW_MS) {
			throw new BadRequestException({
				code: "WINDOW_TOO_LARGE",
				message: "The logs window must be 24 hours or less",
			});
		}
		const backend = await this.requireActiveBackend(projectId);
		const client = this.requireClient();
		const rows = await this.upstream("api", () =>
			client.queryLogs(backend, {
				endIso: query.end,
				rowSchema: cloudLogRowSchema,
				sql: buildLogsSql(query),
				startIso: query.start,
			}),
		);
		return {
			entries: rows.map((row) => ({
				id: row.id,
				level: logLevelOf(LOG_SOURCES[query.source].kind, row.level_value),
				message: row.event_message ?? "",
				timestamp: logTimestampIso(row.timestamp),
			})),
		};
	}

	/**
	 * The Edge Functions with their last deploy time and the calls of the
	 * last 24 hours; cached 30 s.
	 */
	async listFunctions(
		scope: ProjectScope,
		projectId: string,
	): Promise<CloudFunctionsResponse> {
		await this.requireProject(scope, projectId);
		const backend = await this.requireActiveBackend(projectId);
		const client = this.requireClient();
		return this.cached(this.functionsCache, backend.ref, async () => {
			const functions = await this.upstream("api", () =>
				client.listFunctions(backend),
			);
			// No function means no logs call: the logs bucket is the small one.
			if (functions.length === 0) {
				return { functions: [] };
			}
			const endMs = Date.now();
			const counts = await this.upstream("api", () =>
				client.queryLogs(backend, {
					endIso: new Date(endMs).toISOString(),
					rowSchema: cloudFunctionCountRowSchema,
					sql: FUNCTION_COUNTS_SQL,
					startIso: new Date(endMs - CLOUD_LOGS_MAX_WINDOW_MS).toISOString(),
				}),
			);
			const countById = new Map<string, number>();
			for (const count of counts) {
				if (count.function_id !== null) {
					countById.set(count.function_id, Math.round(count.count));
				}
			}
			return {
				functions: functions.map((fn) => ({
					id: fn.id,
					invocations24h: countById.get(fn.id) ?? 0,
					lastDeployedAt: new Date(fn.updated_at).toISOString(),
					name: fn.name,
					slug: fn.slug,
					status: fn.status,
					version: fn.version,
				})),
			};
		});
	}

	/** The pg_cron jobs with their last 20 runs; `installed: false` without pg_cron. */
	async listJobs(
		scope: ProjectScope,
		projectId: string,
	): Promise<CloudJobsResponse> {
		await this.requireProject(scope, projectId);
		const backend = await this.requireActiveBackend(projectId);
		const check = singleRow(
			await this.query(backend, CRON_INSTALLED_SQL, cloudInstalledRowSchema),
		);
		if (!check.installed) {
			return { installed: false, jobs: [] };
		}
		const rows = await this.query(backend, JOBS_SQL, cloudJobRowSchema);
		return {
			installed: true,
			jobs: rows.map((job) => ({
				active: job.active,
				command: job.command,
				jobId: job.jobid,
				name: job.jobname,
				runs: job.runs.map((run) => ({
					endTime: run.end_time,
					returnMessage: run.return_message,
					runId: run.runid,
					startTime: run.start_time,
					status: run.status,
				})),
				schedule: job.schedule,
			})),
		};
	}

	// Same gate as the versions routes: a V1 project or another workspace's
	// project answers 404, not 403.
	private async requireProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<ScopedAppProject> {
		const project = await this.appCommits.findScopedProject(scope, projectId);
		if (project === null || project.engine !== "v2_app") {
			throw new NotFoundException();
		}
		return project;
	}

	// Every panel except the backend routes needs an `active` row with a
	// ref: `paused` answers BACKEND_PAUSED, every other state BACKEND_NOT_READY.
	private async requireActiveBackend(
		projectId: string,
	): Promise<ActiveBackend> {
		const row = await this.backends.findByProjectId(projectId);
		if (row?.status === "paused") {
			throw new ConflictException({
				code: "BACKEND_PAUSED",
				message: "The backend is paused; restore it first",
			});
		}
		if (row === null || row.status !== "active" || row.ref === null) {
			throw backendNotReady();
		}
		return { id: row.id, projectId, ref: row.ref };
	}

	private requireClient(): SupabaseManagementClient {
		if (this.client === null) {
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: "SUPABASE_PLATFORM_TOKEN is not set",
			});
		}
		return this.client;
	}

	// The service-role key comes from the Management API on each call and
	// never leaves this process. A follow-up swaps this read for
	// `ProjectSecretsService.readValue` on the `project_secrets` store.
	private async storageRef(backend: ActiveBackend): Promise<StorageRef> {
		const client = this.requireClient();
		const serviceRoleKey = await this.upstream("api", () =>
			client.getServiceRoleKey(backend),
		);
		return { projectId: backend.projectId, ref: backend.ref, serviceRoleKey };
	}

	// The `public` tables with columns and estimates; cached 30 s per ref.
	// The rows route checks names against this list, so a table created
	// inside the window answers INVALID_IDENTIFIER until it expires.
	private loadTables(backend: ActiveBackend): Promise<CloudTable[]> {
		return this.cached(this.tablesCache, backend.ref, async () => {
			const rows = await this.query(
				backend,
				TABLES_SQL,
				cloudTableColumnRowSchema,
			);
			const tables = new Map<string, CloudTable>();
			for (const row of rows) {
				const table = tables.get(row.table_name) ?? {
					columns: [],
					name: row.table_name,
					rowCount: Math.round(row.row_estimate),
					rowCountExact: false,
				};
				table.columns.push({
					dataType: row.data_type,
					defaultValue: row.column_default,
					isNullable: row.is_nullable,
					name: row.column_name,
				});
				tables.set(row.table_name, table);
			}
			return [...tables.values()];
		});
	}

	// One SQL text on the backend. Reads stay read-only upstream; only the
	// confirmed console write passes `readOnly: false`.
	private query<TRow>(
		backend: ActiveBackend,
		sql: string,
		rowSchema: z.ZodType<TRow>,
		options?: { readOnly: boolean },
	): Promise<TRow[]> {
		const client = this.requireClient();
		return this.upstream("query", () =>
			client.runQuery(backend, {
				readOnly: options?.readOnly ?? true,
				rowSchema,
				sql,
			}),
		);
	}

	/**
	 * Maps a client failure to the route's error. A full bucket or an
	 * upstream 429 answers 429 with the wait; a `query` call the database
	 * refused answers 400 `QUERY_FAILED` with the Postgres message; every
	 * other failure answers 503 `UPSTREAM_UNAVAILABLE`.
	 */
	private async upstream<T>(
		kind: "query" | "api",
		work: () => Promise<T>,
	): Promise<T> {
		try {
			return await work();
		} catch (error) {
			if (error instanceof SupabaseRateLimitedError) {
				throw new CloudRateLimitedException(
					Math.max(1, Math.ceil(error.retryAfterMs / 1000)),
				);
			}
			if (!(error instanceof SupabaseManagementError)) {
				throw error;
			}
			if (
				kind === "query" &&
				error.status !== null &&
				error.status < 500 &&
				error.detail !== null
			) {
				throw new BadRequestException({
					code: "QUERY_FAILED",
					message: error.detail,
				});
			}
			this.logger.warn(
				`cloud.upstream-failed status=${error.status} requestId=${error.requestId} ${error.message}`,
			);
			throw new ServiceUnavailableException({
				code: "UPSTREAM_UNAVAILABLE",
				message: "Supabase did not answer",
			});
		}
	}

	// A fresh entry lives CLOUD_CACHE_TTL_MS; a stale one is reloaded.
	private async cached<T>(
		store: Map<string, CacheEntry<T>>,
		key: string,
		load: () => Promise<T>,
	): Promise<T> {
		const now = Date.now();
		const hit = store.get(key);
		if (hit !== undefined && hit.expiresAt > now) {
			return hit.value;
		}
		const value = await load();
		// A miss happens at most once per ref per TTL, so the sweep is cheap
		// and keeps the map at the refs seen in the last 30 s.
		for (const [entryKey, entry] of store) {
			if (entry.expiresAt <= now) {
				store.delete(entryKey);
			}
		}
		store.set(key, { expiresAt: now + CLOUD_CACHE_TTL_MS, value });
		return value;
	}
}

function backendAnswer(row: AppBackendRow | null): CloudBackendResponse {
	if (row === null) {
		return { failureCode: null, ref: null, region: null, status: "none" };
	}
	return {
		failureCode: row.failureCode,
		ref: row.ref,
		region: row.region,
		status: row.status,
	};
}

function backendNotReady(): ConflictException {
	return new ConflictException({
		code: "BACKEND_NOT_READY",
		message: "The backend is not ready",
	});
}

function invalidIdentifier(name: string): BadRequestException {
	return new BadRequestException({
		code: "INVALID_IDENTIFIER",
		message: `Unknown table or column: ${name}`,
	});
}

function organizationIdOf(scope: ProjectScope): string | null {
	return scope.kind === "org" ? scope.organizationId : null;
}

// A `count(*)` or a paged query always answers one row; none means the
// upstream changed shape.
function singleRow<TRow>(rows: TRow[]): TRow {
	const [row] = rows;
	if (row === undefined) {
		throw new ServiceUnavailableException({
			code: "UPSTREAM_UNAVAILABLE",
			message: "Supabase answered no row",
		});
	}
	return row;
}

/** Quotes one identifier for SQL: `"` around it, an inner `"` doubled. */
export function quoteIdentifier(name: string): string {
	return `"${name.replaceAll('"', '""')}"`;
}

function qualifiedTable(name: string): string {
	return `"public".${quoteIdentifier(name)}`;
}

// A timestamptz as ISO 8601 UTC text with milliseconds, so the answer
// parses with `isoDateTimeSchema`. Null stays null.
function isoUtc(column: string): string {
	return `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

// A string literal for the logs SQL: backslashes and quotes escaped.
function escapeSqlLiteral(text: string): string {
	return text.replaceAll("\\", "\\\\").replaceAll("'", "''");
}

/** The logs SQL of one request: source table, level and search filters, newest first. */
export function buildLogsSql(query: CloudLogsQuery): string {
	const source = LOG_SOURCES[query.source];
	const filters: string[] = [];
	if (query.level !== undefined) {
		filters.push(
			`${source.levelColumn} ${LEVEL_FILTERS[source.kind][query.level]}`,
		);
	}
	if (query.search !== undefined) {
		filters.push(`event_message like '%${escapeSqlLiteral(query.search)}%'`);
	}
	const where = filters.length === 0 ? "" : ` where ${filters.join(" and ")}`;
	return `select id, timestamp, event_message, ${source.levelColumn} as level_value from ${source.table} ${source.joins}${where} order by timestamp desc limit ${CLOUD_LOGS_PAGE_SIZE}`;
}

// HTTP status classes and Postgres severities fold into three levels.
function logLevelOf(
	kind: "status" | "severity",
	value: number | string | null,
): CloudLogLevel {
	if (kind === "severity") {
		const severity = String(value ?? "").toUpperCase();
		if (severity === "ERROR" || severity === "FATAL" || severity === "PANIC") {
			return "error";
		}
		return severity === "WARNING" ? "warning" : "info";
	}
	const status = Number(value ?? 0);
	if (status >= 500) {
		return "error";
	}
	return status >= 400 ? "warning" : "info";
}

// The analytics endpoint answers unix microseconds (UNVERIFIED) or ISO text.
function logTimestampIso(timestamp: number | string): string {
	const ms =
		typeof timestamp === "number" ? timestamp / 1000 : Date.parse(timestamp);
	return new Date(ms).toISOString();
}
