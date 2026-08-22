/**
 * Persistence for captured leads.
 *
 * Two access paths with different trust levels: the public capture endpoint
 * resolves a project by its unguessable publicFormId (no user in sight), and
 * the workspace endpoints prove ownership in SQL through the projects join
 * (misses read as 404, never 403 — docs/api-security.md).
 */

import { Inject, Injectable } from "@nestjs/common";
import type {
	LeadSource,
	LeadStatus,
	LeadsQuery,
	LeadTotals,
	WorkspaceLeadsQuery,
} from "@wandit/contracts";
import {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	isNull,
	lt,
	or,
	type SQL,
	sql,
} from "@wandit/db";
import { versions } from "@wandit/db/schema/artifacts";
import { deployments } from "@wandit/db/schema/deployments";
import { leads } from "@wandit/db/schema/leads";
import { projects } from "@wandit/db/schema/projects";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type ProjectScope,
	projectScopePredicate,
} from "../../../projects/domain/project-scope";
import {
	FACEBOOK_UTM_SOURCES,
	TIKTOK_UTM_SOURCES,
} from "../../domain/derive-lead-source";

export type LeadRow = {
	archivedAt: Date | null;
	attribution: unknown;
	commune: string | null;
	createdAt: Date;
	extras: unknown;
	id: string;
	name: string;
	phone: string;
	productSku: string | null;
	status: LeadStatus;
	wilaya: string | null;
};

const LEAD_COLUMNS = {
	archivedAt: leads.archivedAt,
	attribution: leads.attribution,
	commune: leads.commune,
	createdAt: leads.createdAt,
	extras: leads.extras,
	id: leads.id,
	name: leads.name,
	phone: leads.phone,
	productSku: leads.productSku,
	status: leads.status,
	wilaya: leads.wilaya,
} as const;

const LEAD_PAGE_COLUMNS = {
	...LEAD_COLUMNS,
	// node-postgres turns timestamptz into a millisecond-resolution Date. Keep
	// the database's full microsecond value solely for the keyset cursor so a
	// boundary cannot skip rows captured within the same millisecond.
	cursorCreatedAt:
		sql<string>`to_char(${leads.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as(
			"lead_cursor_created_at",
		),
} as const;

const WORKSPACE_LEAD_PAGE_COLUMNS = {
	...LEAD_PAGE_COLUMNS,
	projectId: leads.projectId,
	projectName: projects.name,
} as const;

const LEGACY_RECENT_LIMIT = 1_000;
const OWNER_PAGE_SIZE_MAX = 100;
const SYNC_PAGE_SIZE_MAX = 1_000;
const CURSOR_CREATED_AT_RE =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d{6}Z$/;
const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LeadListFilters = Partial<
	Pick<
		LeadsQuery,
		"archived" | "createdFrom" | "createdTo" | "q" | "source" | "status"
	>
> & {
	// Workspace-wide list only: narrow to one project.
	projectId?: string;
};

type LeadCursor = {
	createdAt: string;
	id: string;
};

type LeadSortDirection = "asc" | "desc";

function buildLeadKeyset(direction: LeadSortDirection, cursor?: LeadCursor) {
	const [order, compare] =
		direction === "asc" ? ([asc, gt] as const) : ([desc, lt] as const);
	const orderBy = [order(leads.createdAt), order(leads.id)] as const;

	if (!cursor) {
		return { afterCursor: undefined, orderBy };
	}

	const cursorCreatedAt = sql`${cursor.createdAt}::timestamptz`;

	return {
		afterCursor: or(
			compare(leads.createdAt, cursorCreatedAt),
			and(eq(leads.createdAt, cursorCreatedAt), compare(leads.id, cursor.id)),
		),
		orderBy,
	};
}

export type LeadPageResult = {
	nextCursor: string | null;
	rows: LeadRow[];
};

export type WorkspaceLeadRow = LeadRow & {
	projectId: string;
	projectName: string;
};

export type WorkspaceLeadPageResult = {
	nextCursor: string | null;
	rows: WorkspaceLeadRow[];
};

export type LeadSyncPageOptions = {
	cursor?: string;
	pageSize: number;
};

export type LeadFunnelGroupBy = "campaign" | "none" | "source" | "status";

/** One funnel row: per-status counts for one group (key null = ungrouped). */
export type LeadFunnelCountRow = {
	cancelled: number;
	confirmed: number;
	delivered: number;
	key: string | null;
	returned: number;
	shipped: number;
	to_confirm: number;
	total: number;
};

export type LeadFunnelCountsOptions = {
	from: Date;
	groupBy: LeadFunnelGroupBy;
	limit?: number;
	to: Date;
};

export type AdsTrackingFacts = {
	metaPixelSet: boolean;
	published: boolean;
	tiktokPixelSet: boolean;
};

// Sanity cap on grouped funnel rows. Callers pick their own page size (the
// read_lead_performance tool probes limit + 1 to detect truncation); this only
// stops a runaway query.
const FUNNEL_GROUP_LIMIT_MAX = 200;
const UTM_CAMPAIGN_KEY_MAX_LENGTH = 200;

export class InvalidLeadCursorError extends Error {
	constructor() {
		super("Invalid lead cursor");
		this.name = "InvalidLeadCursorError";
	}
}

function encodeLeadCursor(cursor: LeadCursor): string {
	return Buffer.from(JSON.stringify({ ...cursor, v: 1 }), "utf8").toString(
		"base64url",
	);
}

function isValidCursorCreatedAt(value: string): boolean {
	const match = CURSOR_CREATED_AT_RE.exec(value);
	if (!match) {
		return false;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	const second = Number(match[6]);
	const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const daysInMonth = [
		31,
		leapYear ? 29 : 28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31,
	][month - 1];

	return (
		year >= 1 &&
		month >= 1 &&
		month <= 12 &&
		day >= 1 &&
		daysInMonth !== undefined &&
		day <= daysInMonth &&
		hour <= 23 &&
		minute <= 59 &&
		second <= 59
	);
}

function decodeLeadCursor(cursor: string): LeadCursor {
	try {
		if (!/^[A-Za-z0-9_-]+$/.test(cursor) || cursor.length > 1_000) {
			throw new InvalidLeadCursorError();
		}

		const decoded: unknown = JSON.parse(
			Buffer.from(cursor, "base64url").toString("utf8"),
		);
		if (
			!decoded ||
			typeof decoded !== "object" ||
			!("v" in decoded) ||
			decoded.v !== 1 ||
			!("createdAt" in decoded) ||
			typeof decoded.createdAt !== "string" ||
			!isValidCursorCreatedAt(decoded.createdAt) ||
			!("id" in decoded) ||
			typeof decoded.id !== "string" ||
			!UUID_RE.test(decoded.id)
		) {
			throw new InvalidLeadCursorError();
		}

		return { createdAt: decoded.createdAt, id: decoded.id };
	} catch (error) {
		if (error instanceof InvalidLeadCursorError) {
			throw error;
		}

		throw new InvalidLeadCursorError();
	}
}

function clampPageSize(pageSize: number, maximum: number): number {
	return Math.min(maximum, Math.max(1, Math.floor(pageSize)));
}

function normalizedPhoneDigits(value: string): string {
	const asciiDigits = value.replace(/[٠-٩۰-۹]/g, (digit) => {
		const codePoint = digit.charCodeAt(0);
		return String(
			codePoint >= 0x06f0 ? codePoint - 0x06f0 : codePoint - 0x0660,
		);
	});
	const digits = asciiDigits.replace(/\D/g, "");

	if (digits.startsWith("00")) {
		return digits.slice(2);
	}

	return digits.replace(/^0/, "");
}

function escapedContainsPattern(value: string): string {
	return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

// SQL mirror of deriveLeadSource (domain/derive-lead-source.ts) so the
// owner lists can filter by source inside the keyset query without a
// stored source column. Precedence must match the JS derivation exactly:
// fbclid → facebook, else ttclid → tiktok, else the utm_source lists, else
// direct. jsonb_typeof guards mirror the typeof-string checks (a numeric
// fbclid is not a click id), and coalesce keeps NULL attribution falsy so
// attribution-less leads count as direct instead of vanishing.
const FB_CLICK = sql<boolean>`coalesce(jsonb_typeof(${leads.attribution} -> 'fbclid') = 'string' and ${leads.attribution} ->> 'fbclid' <> '', false)`;
const TT_CLICK = sql<boolean>`coalesce(jsonb_typeof(${leads.attribution} -> 'ttclid') = 'string' and ${leads.attribution} ->> 'ttclid' <> '', false)`;
// btrim's default set is U+0020 only, but the JS derivation trims the full
// ECMAScript whitespace set — pass that exact set so `utm_source=facebook%0A`
// filters the same way it badges.
const JS_TRIM_WHITESPACE =
	"\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF";
const UTM_SOURCE = sql<string>`lower(btrim(coalesce(case when jsonb_typeof(${leads.attribution} -> 'utm_source') = 'string' then ${leads.attribution} ->> 'utm_source' end, ''), ${JS_TRIM_WHITESPACE}))`;

function utmSourceList(values: readonly string[]): SQL {
	return sql.join(
		values.map((value) => sql`${value}`),
		sql`, `,
	);
}

function leadSourcePredicate(source: LeadSource): SQL<boolean> {
	if (source === "facebook") {
		return sql<boolean>`(${FB_CLICK} or (not ${TT_CLICK} and ${UTM_SOURCE} in (${utmSourceList(FACEBOOK_UTM_SOURCES)})))`;
	}

	if (source === "tiktok") {
		return sql<boolean>`(not ${FB_CLICK} and (${TT_CLICK} or ${UTM_SOURCE} in (${utmSourceList(TIKTOK_UTM_SOURCES)})))`;
	}

	return sql<boolean>`(not ${FB_CLICK} and not ${TT_CLICK} and ${UTM_SOURCE} not in (${utmSourceList([...FACEBOOK_UTM_SOURCES, ...TIKTOK_UTM_SOURCES])}))`;
}

// Grouping keys for the funnel read. The source key reuses the
// leadSourcePredicate mirror so it can never drift from the badge logic; the
// predicates are mutually exclusive, so the CASE order is irrelevant.
const LEAD_SOURCE_KEY = sql<string>`case when ${leadSourcePredicate("facebook")} then 'facebook' when ${leadSourcePredicate("tiktok")} then 'tiktok' else 'direct' end`;
const UTM_CAMPAIGN_KEY = sql<
	string | null
>`nullif(left(lower(btrim(coalesce(case when jsonb_typeof(${leads.attribution} -> 'utm_campaign') = 'string' then ${leads.attribution} ->> 'utm_campaign' end, ''), ${JS_TRIM_WHITESPACE})), ${UTM_CAMPAIGN_KEY_MAX_LENGTH}), '')`;

function leadFunnelGroupKey(groupBy: LeadFunnelGroupBy): SQL<string | null> {
	switch (groupBy) {
		case "source":
			return LEAD_SOURCE_KEY;
		case "campaign":
			return UTM_CAMPAIGN_KEY;
		case "status":
			return sql<string>`${leads.status}::text`;
		case "none":
			return sql<string | null>`null::text`;
	}
}

/**
 * The funnel query itself, exported (without running it) so a spec can read
 * the rendered SQL through `.toSQL()`: drizzle builders are thenables, and the
 * async repository method awaits this one.
 */
export function buildLeadFunnelCountsQuery(
	db: Database,
	projectId: string,
	options: LeadFunnelCountsOptions,
) {
	const key = leadFunnelGroupKey(options.groupBy);
	const limit = clampPageSize(
		options.limit ?? FUNNEL_GROUP_LIMIT_MAX,
		FUNNEL_GROUP_LIMIT_MAX,
	);
	const total = sql<number>`count(*)::int`;

	const base = db
		.select({
			cancelled: sql<number>`count(*) filter (where ${leads.status} = 'cancelled')::int`,
			confirmed: sql<number>`count(*) filter (where ${leads.status} = 'confirmed')::int`,
			delivered: sql<number>`count(*) filter (where ${leads.status} = 'delivered')::int`,
			key: key.as("lead_funnel_key"),
			returned: sql<number>`count(*) filter (where ${leads.status} = 'returned')::int`,
			shipped: sql<number>`count(*) filter (where ${leads.status} = 'shipped')::int`,
			to_confirm: sql<number>`count(*) filter (where ${leads.status} = 'to_confirm')::int`,
			total,
		})
		.from(leads)
		.where(
			and(
				eq(leads.projectId, projectId),
				isNull(leads.archivedAt),
				gte(leads.createdAt, options.from),
				lt(leads.createdAt, options.to),
			),
		);

	if (options.groupBy === "none") {
		// Plain aggregate: one row, key null (a constant in GROUP BY is
		// pointless and Postgres is picky about it).
		return base;
	}

	// Group and order on the output alias, not on `key`: rendering the
	// parameterised key expression a second time gives it fresh bind ids,
	// and Postgres then rejects the select list (42803) for source/campaign.
	return base
		.groupBy(sql`lead_funnel_key`)
		.orderBy(desc(total), sql`lead_funnel_key nulls last`)
		.limit(limit);
}

@Injectable()
export class LeadsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** Capture path: unguessable form id → live project, or null. */
	async findProjectByPublicFormId(
		publicFormId: string,
	): Promise<{ id: string } | null> {
		const [row] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.publicFormId, publicFormId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/** Live deployment/version facts snapshotted onto a captured lead. */
	async findActiveDeploymentSnapshot(projectId: string): Promise<{
		deploymentId: string;
		productSku: string | null;
	} | null> {
		return this.findDeploymentSnapshot(
			projectId,
			eq(deployments.status, "active"),
		);
	}

	/**
	 * No status filter: the unguessable id comes from injected page bytes, so any
	 * deployment belonging to this project is an honest loaded-version claim.
	 */
	async findDeploymentSnapshotById(
		projectId: string,
		deploymentId: string,
	): Promise<{
		deploymentId: string;
		productSku: string | null;
	} | null> {
		return this.findDeploymentSnapshot(
			projectId,
			eq(deployments.id, deploymentId),
		);
	}

	private async findDeploymentSnapshot(
		projectId: string,
		extraCondition: SQL,
	): Promise<{
		deploymentId: string;
		productSku: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				deploymentId: deployments.id,
				productSku: versions.productSku,
			})
			.from(deployments)
			.innerJoin(versions, eq(versions.id, deployments.versionId))
			.where(and(eq(deployments.projectId, projectId), extraCondition))
			.limit(1);

		return row ?? null;
	}

	/**
	 * Tracking prerequisites the ads director checks before any diagnosis:
	 * are the pixel ids set on the project, and is a page live to receive
	 * the clicks. A missing/deleted project reads as all-false.
	 */
	async getAdsTrackingFacts(projectId: string): Promise<AdsTrackingFacts> {
		const [[project], activeDeployment] = await Promise.all([
			this.db
				.select({
					metaPixelId: projects.metaPixelId,
					tiktokPixelId: projects.tiktokPixelId,
				})
				.from(projects)
				.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
				.limit(1),
			this.findActiveDeploymentSnapshot(projectId),
		]);

		return {
			metaPixelSet: Boolean(project?.metaPixelId?.trim()),
			published: activeDeployment !== null,
			tiktokPixelSet: Boolean(project?.tiktokPixelId?.trim()),
		};
	}

	/**
	 * Funnel counts for the chat director's read_lead_performance tool: one
	 * row per group (or a single ungrouped row for "none"), non-archived leads
	 * of one project captured in [from, to). Ownership is NOT re-proven here —
	 * callers pass the projectId of an already-owned chat. Rows order by total
	 * desc and cap at `limit` (200 max).
	 */
	async getFunnelCountsForProject(
		projectId: string,
		options: LeadFunnelCountsOptions,
	): Promise<LeadFunnelCountRow[]> {
		return buildLeadFunnelCountsQuery(this.db, projectId, options);
	}

	/**
	 * The capture window drops nothing: serialize each project/phone pair so
	 * the newest honest submission always wins its row. Lifecycle fields and
	 * createdAt belong to the first submission and are never replaced.
	 */
	async upsertCaptureLead(
		input: {
			attribution: Record<string, unknown> | null;
			commune: string | null;
			deploymentId: string | null;
			extras: Record<string, unknown> | null;
			name: string;
			phone: string;
			productSku: string | null;
			projectId: string;
			wilaya: string | null;
		},
		since: Date,
	): Promise<void> {
		await this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtextextended(${`${input.projectId}:${input.phone}`}, 0))`,
			);

			const [recent] = await tx
				.select({ id: leads.id })
				.from(leads)
				.where(
					and(
						eq(leads.projectId, input.projectId),
						eq(leads.phone, input.phone),
						gt(leads.createdAt, since),
					),
				)
				.orderBy(desc(leads.createdAt), desc(leads.id))
				.limit(1);

			if (recent) {
				await tx
					.update(leads)
					.set({
						attribution: input.attribution,
						commune: input.commune,
						deploymentId: input.deploymentId,
						extras: input.extras,
						name: input.name,
						productSku: input.productSku,
						wilaya: input.wilaya,
					})
					.where(eq(leads.id, recent.id));
				return;
			}

			await tx.insert(leads).values(input);
		});
	}

	async listForProject(
		scope: ProjectScope,
		projectId: string,
		limit = LEGACY_RECENT_LIMIT,
	): Promise<LeadRow[]> {
		return this.listAccessibleRecent(
			scope,
			projectId,
			clampPageSize(limit, LEGACY_RECENT_LIMIT),
		);
	}

	listForProjectPage(
		scope: ProjectScope,
		projectId: string,
		query: LeadsQuery,
	): Promise<LeadPageResult> {
		return this.listAccessiblePage(
			scope,
			projectId,
			query,
			OWNER_PAGE_SIZE_MAX,
		);
	}

	async countForProject(
		scope: ProjectScope,
		projectId: string,
		filters: LeadListFilters = {},
	): Promise<number> {
		const [row] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(this.accessibleWhere(scope, projectId, filters));

		return row?.total ?? 0;
	}

	/**
	 * Dashboard aggregate: one keyset page across every project the scope can
	 * see, newest first. Same machinery as the per-project page — the project
	 * clause just became optional (a filter instead of a path segment).
	 */
	async listForWorkspacePage(
		scope: ProjectScope,
		query: WorkspaceLeadsQuery,
	): Promise<WorkspaceLeadPageResult> {
		const pageSize = clampPageSize(query.pageSize, OWNER_PAGE_SIZE_MAX);
		const cursor = query.cursor ? decodeLeadCursor(query.cursor) : undefined;
		const keyset = buildLeadKeyset("desc", cursor);
		const selected = await this.db
			.select(WORKSPACE_LEAD_PAGE_COLUMNS)
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(this.accessibleWhere(scope, undefined, query, keyset.afterCursor))
			.orderBy(...keyset.orderBy)
			.limit(pageSize + 1);
		const hasNextPage = selected.length > pageSize;
		const page = selected.slice(0, pageSize);
		const last = page.at(-1);

		return {
			nextCursor:
				hasNextPage && last
					? encodeLeadCursor({
							createdAt: last.cursorCreatedAt,
							id: last.id,
						})
					: null,
			rows: page.map(({ cursorCreatedAt: _cursorCreatedAt, ...row }) => row),
		};
	}

	async countForWorkspace(
		scope: ProjectScope,
		filters: LeadListFilters = {},
	): Promise<number> {
		const [row] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(this.accessibleWhere(scope, undefined, filters));

		return row?.total ?? 0;
	}

	async getTotalsForProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<LeadTotals> {
		const [row] = await this.db
			.select({
				cancelled: sql<number>`count(*) filter (where ${leads.status} = 'cancelled')::int`,
				confirmed: sql<number>`count(*) filter (where ${leads.status} = 'confirmed')::int`,
				last7Days: sql<number>`count(*) filter (where ${leads.createdAt} >= now() - interval '7 days')::int`,
				today: sql<number>`count(*) filter (where ${leads.createdAt} >= (date_trunc('day', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers'))::int`,
				total: sql<number>`count(*)::int`,
			})
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(this.accessibleWhere(scope, projectId));

		return (
			row ?? {
				cancelled: 0,
				confirmed: 0,
				last7Days: 0,
				today: 0,
				total: 0,
			}
		);
	}

	listForProjectSync(
		scope: ProjectScope,
		projectId: string,
		options: LeadSyncPageOptions,
	): Promise<LeadPageResult> {
		return this.listAccessiblePage(
			scope,
			projectId,
			{ ...options, archived: "include" },
			SYNC_PAGE_SIZE_MAX,
			"asc",
		);
	}

	private async listAccessiblePage(
		scope: ProjectScope,
		projectId: string,
		options: LeadListFilters & LeadSyncPageOptions,
		maximumPageSize: number,
		direction: LeadSortDirection = "desc",
	): Promise<LeadPageResult> {
		const pageSize = clampPageSize(options.pageSize, maximumPageSize);
		const cursor = options.cursor
			? decodeLeadCursor(options.cursor)
			: undefined;
		const keyset = buildLeadKeyset(direction, cursor);
		const selected = await this.db
			.select(LEAD_PAGE_COLUMNS)
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(
				this.accessibleWhere(scope, projectId, options, keyset.afterCursor),
			)
			.orderBy(...keyset.orderBy)
			.limit(pageSize + 1);
		const hasNextPage = selected.length > pageSize;
		const page = selected.slice(0, pageSize);
		const last = page.at(-1);

		return {
			nextCursor:
				hasNextPage && last
					? encodeLeadCursor({
							createdAt: last.cursorCreatedAt,
							id: last.id,
						})
					: null,
			rows: page.map(({ cursorCreatedAt: _cursorCreatedAt, ...row }) => row),
		};
	}

	private listAccessibleRecent(
		scope: ProjectScope,
		projectId: string,
		limit: number,
	): Promise<LeadRow[]> {
		return this.db
			.select(LEAD_COLUMNS)
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(this.accessibleWhere(scope, projectId))
			.orderBy(desc(leads.createdAt), desc(leads.id))
			.limit(limit);
	}

	/**
	 * The shared ownership + filter clause. `projectId` is the path-derived
	 * project (per-project endpoints); when it is undefined the query spans the
	 * whole scope and `filters.projectId` may narrow it back down.
	 */
	private accessibleWhere(
		scope: ProjectScope,
		projectId: string | undefined,
		filters: LeadListFilters = {},
		afterCursor?: SQL,
	) {
		const targetProjectId = projectId ?? filters.projectId;
		const query = filters.q?.trim();
		const phoneDigits = query ? normalizedPhoneDigits(query) : "";
		const search = query
			? or(
					sql<boolean>`${leads.name} ilike ${escapedContainsPattern(query)} escape '\\'`,
					phoneDigits
						? sql<boolean>`regexp_replace(${leads.phone}, '[^0-9]', '', 'g') like ${`%${phoneDigits}%`}`
						: undefined,
				)
			: undefined;
		const archived = filters.archived ?? "exclude";
		const archivedPredicate =
			archived === "only"
				? sql<boolean>`${leads.archivedAt} is not null`
				: archived === "exclude"
					? isNull(leads.archivedAt)
					: undefined;
		const createdFrom = filters.createdFrom
			? sql<boolean>`${leads.createdAt} >= (${filters.createdFrom}::date::timestamp at time zone 'Africa/Algiers')`
			: undefined;
		const createdTo = filters.createdTo
			? sql<boolean>`${leads.createdAt} < (((${filters.createdTo}::date + 1)::timestamp) at time zone 'Africa/Algiers')`
			: undefined;

		return and(
			targetProjectId ? eq(leads.projectId, targetProjectId) : undefined,
			projectScopePredicate(scope),
			isNull(projects.deletedAt),
			filters.status ? eq(leads.status, filters.status) : undefined,
			filters.source ? leadSourcePredicate(filters.source) : undefined,
			archivedPredicate,
			createdFrom,
			createdTo,
			search,
			afterCursor,
		);
	}

	async updateAccessibleLeadStatus(
		scope: ProjectScope,
		projectId: string,
		leadId: string,
		status: LeadStatus,
	): Promise<LeadRow | null> {
		const [owned] = await this.db
			.select({ id: leads.id })
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(
				and(
					eq(leads.id, leadId),
					eq(leads.projectId, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		if (!owned) {
			return null;
		}

		const [row] = await this.db
			.update(leads)
			.set({ status, statusChangedAt: new Date() })
			.where(eq(leads.id, leadId))
			.returning(LEAD_COLUMNS);

		return row ?? null;
	}

	async updateAccessibleLeadArchived(
		scope: ProjectScope,
		projectId: string,
		leadId: string,
		archived: boolean,
	): Promise<LeadRow | null> {
		const [owned] = await this.db
			.select(LEAD_COLUMNS)
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(
				and(
					eq(leads.id, leadId),
					eq(leads.projectId, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		if (!owned) {
			return null;
		}

		if (Boolean(owned.archivedAt) === archived) {
			return owned;
		}

		const [row] = await this.db
			.update(leads)
			.set({ archivedAt: archived ? sql`now()` : null })
			.where(eq(leads.id, leadId))
			.returning(LEAD_COLUMNS);

		return row ?? null;
	}
}
