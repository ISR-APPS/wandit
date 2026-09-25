/**
 * Provision-backend runtime: creates the hidden Supabase project of one
 * V2 app and walks its `app_backends` row to `active` (WANDIT-183, D18).
 * The steps run in order: claim the `creating` row by `requestKey`.
 * Create the project when the row has no ref. Poll to `ACTIVE_HEALTHY`.
 * Read the anon key. Apply the base schema. Set the auth config.
 * Mark active. Write the audit row.
 * It calls `AppBackendsRepository`, `SupabaseManagementClient`,
 * `AuditEventsRepository`, and Sentry.
 * `provision-backend.task.ts` calls it through
 * `createProvisionBackendRuntime`; the spec runs `runProvisionBackend` on
 * fakes. No Nest here — Trigger workers compose dependencies by hand.
 */
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { wait } from "@trigger.dev/sdk";
import {
	type SupabaseInstanceSize,
	supabaseInstanceSizeSchema,
	supabaseRegionSchema,
} from "@wandit/contracts";
import type { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/node";

import type { SandboxLogger } from "../modules/app-builder/domain/ports/sandbox-provider";
import type { AppBackendFailure } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { AppBackendsRepository } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { AuditEventsRepository } from "../modules/app-builder/infrastructure/persistence/audit-events.repository";
import { TEMPLATE_ARCHIVE_DIR } from "../modules/app-builder/infrastructure/sandbox/template-init";
import {
	type SupabaseManagementClient,
	SupabaseManagementError,
	supabaseWorkerClientFromEnv,
} from "../modules/app-builder/infrastructure/supabase/supabase-management.client";

type TriggerDatabase = ReturnType<typeof createDb>;

// Issue step 4: one status poll every 5 s.
const POLL_INTERVAL_MS = 5_000;
// Issue step 4: the poll gives up after 10 minutes.
const POLL_TIMEOUT_MS = 600_000;
// The WANDIT-168 base schema under `TEMPLATE_ARCHIVE_DIR`; it enables
// pg_cron and creates `public.profiles` with RLS.
const BASE_SQL_RELATIVE_PATH = "web-app/supabase/migrations/0000_base.sql";

/** Payload of one `provision-backend` run. */
export type ProvisionBackendInput = {
	/** `projects.id` of the app the backend belongs to. */
	projectId: string;
	/**
	 * The row's dedupe key; the API made it the task idempotency key.
	 * The runtime exits when the stored key differs.
	 */
	requestKey: string;
};

/** The slice of the provisioning the spec fakes. */
export type ProvisionBackendDeps = {
	/** Reads and marks the `app_backends` row; the API ran `insertCreatingWithinLimit`. */
	backends: Pick<
		AppBackendsRepository,
		"findByProjectId" | "markCreated" | "markActive" | "markError"
	>;
	/** Append-only writer of the `backend.provisioned` audit row. */
	auditEvents: Pick<AuditEventsRepository, "insert">;
	/**
	 * Management API client. Null when the worker env lacks
	 * `SUPABASE_PLATFORM_TOKEN` or `SUPABASE_PLATFORM_ORG_ID`; the run then
	 * fails `backend_provision_unconfigured`.
	 */
	client: Pick<
		SupabaseManagementClient,
		| "createProject"
		| "getProject"
		| "getApiKeys"
		| "runSql"
		| "updateAuthConfig"
	> | null;
	/** `desired_instance_size` of the create call, from `SUPABASE_PLATFORM_INSTANCE_SIZE`. */
	instanceSize: SupabaseInstanceSize;
	/** `env.PREVIEW_DOMAIN`; null skips the auth-config step. */
	previewDomain: string | null;
	/** Reads the base schema file; a throw fails `backend_base_schema_missing`. */
	readBaseSql: () => Promise<string>;
	/** `wait.for` in production; the spec adds the ms to a fake clock. */
	sleep: (ms: number) => Promise<void>;
	/** `Date.now` in production; the spec reads a fake clock. */
	now: () => number;
	/** `Sentry.captureException` bound with the run tags; answers the event id. */
	captureException: (
		error: unknown,
		tags: { projectId: string; ref: string | null },
	) => string | undefined;
	/** `Sentry.logger` in production; the spec records lines. */
	logger: SandboxLogger;
};

/** Outcome of one run; "skipped" means the row moved on without this run. */
export type ProvisionBackendResult = {
	outcome: "active" | "skipped" | "error";
	/** Machine failure code on `error`, else null. */
	failureCode: string | null;
};

/**
 * `SUPABASE_PLATFORM_INSTANCE_SIZE` parsed. "micro" on a missing or an
 * invalid value: the issue names `micro` as the default until the Supabase
 * for Platforms contract names a size.
 */
export function instanceSizeFromEnv(
	value: string | undefined,
	logger: SandboxLogger,
): SupabaseInstanceSize {
	if (value === undefined) {
		return "micro";
	}
	const parsed = supabaseInstanceSizeSchema.safeParse(value);
	if (!parsed.success) {
		logger.warn("supabase.provisioning.instance-size-invalid", { value });
		return "micro";
	}
	return parsed.data;
}

/**
 * Runs the provisioning steps for one `creating` `app_backends` row.
 * Never throws for a handled failure. Every failure exit goes through
 * `fail`. It stores the failure columns, captures to Sentry, and answers
 * the error outcome.
 */
export async function runProvisionBackend(
	deps: ProvisionBackendDeps,
	input: ProvisionBackendInput,
): Promise<ProvisionBackendResult> {
	const { projectId } = input;
	const row = await deps.backends.findByProjectId(projectId);
	if (
		row === null ||
		row.status !== "creating" ||
		row.requestKey !== input.requestKey
	) {
		const reason =
			row === null
				? "no-row"
				: row.status !== "creating"
					? `status-${row.status}`
					: "request-key-mismatch";
		deps.logger.info("supabase.provisioning.skipped", {
			projectId,
			reason,
		});
		return { outcome: "skipped", failureCode: null };
	}

	// The worker env can differ from the API env: without the token or the
	// org slug the run cannot create anything.
	if (deps.client === null) {
		return fail(deps, {
			error: new Error(
				"worker env lacks SUPABASE_PLATFORM_TOKEN or SUPABASE_PLATFORM_ORG_ID",
			),
			failureCode: "backend_provision_unconfigured",
			failureKind: "config",
			failureSource: "task",
			projectId,
			ref: row.ref,
		});
	}
	const client = deps.client;

	let ref = row.ref;
	const startedAt = deps.now();
	try {
		if (ref === null) {
			const region = supabaseRegionSchema.safeParse(row.region);
			if (!region.success) {
				return fail(deps, {
					error: new Error(
						`app_backends.region "${row.region}" is not a Supabase region`,
					),
					failureCode: "backend_provision_failed",
					failureKind: "config",
					failureSource: "task",
					projectId,
					ref,
				});
			}
			// 32 random bytes as base64url = 43 characters. The password is
			// used once in the create call and never stored or logged.
			const dbPassword = randomBytes(32).toString("base64url");
			const created = await client.createProject({
				projectId,
				region: region.data,
				dbPassword,
				instanceSize: deps.instanceSize,
			});
			ref = created.ref;
			await deps.backends.markCreated(projectId, created);
			deps.logger.info("supabase.provisioning.created", {
				projectId,
				ref,
				region: row.region,
			});
		} else {
			// A re-run of the same requestKey finds the ref already stored:
			// this is what makes a replay create no second project.
			deps.logger.info("supabase.provisioning.resumed", {
				projectId,
				ref,
			});
		}

		// The loop exits through `break` on ACTIVE_HEALTHY or through `fail`
		// on a terminal status or the deadline — never through the header.
		let dbHost = "";
		while (true) {
			const project = await client.getProject({ projectId, ref });
			if (project.status === "ACTIVE_HEALTHY") {
				dbHost = project.dbHost;
				break;
			}
			if (
				project.status === "INIT_FAILED" ||
				project.status === "REMOVED" ||
				project.status === "RESTORE_FAILED"
			) {
				return fail(deps, {
					error: new Error(
						`supabase project ${ref} reported ${project.status}`,
					),
					failureCode: "backend_provision_failed",
					failureKind: "provider",
					failureProviderMessage: project.status,
					failureSource: "supabase_api",
					projectId,
					ref,
				});
			}
			if (deps.now() - startedAt >= POLL_TIMEOUT_MS) {
				return fail(deps, {
					error: new Error(
						`supabase project ${ref} still ${project.status} after ${POLL_TIMEOUT_MS} ms`,
					),
					failureCode: "backend_provision_timeout",
					failureKind: "timeout",
					failureSource: "supabase_api",
					projectId,
					ref,
				});
			}
			await deps.sleep(POLL_INTERVAL_MS);
		}

		const { anonKey } = await client.getApiKeys({ projectId, ref });

		let baseSql: string;
		try {
			baseSql = await deps.readBaseSql();
		} catch (error) {
			return fail(deps, {
				error,
				failureCode: "backend_base_schema_missing",
				failureKind: "config",
				failureSource: "task",
				projectId,
				ref,
			});
		}
		await client.runSql({ projectId, ref }, baseSql);

		if (deps.previewDomain === null) {
			deps.logger.warn("supabase.provisioning.auth-config-skipped", {
				projectId,
				ref,
			});
		} else {
			// LIMIT: `site_url` is the preview apex until WANDIT-190 registers
			// the published domain. Upgrade: pass the published host.
			await client.updateAuthConfig(
				{ projectId, ref },
				{
					siteUrl: `https://${deps.previewDomain}`,
					uriAllowList: [
						`https://r-*--p-${projectId}.${deps.previewDomain}/**`,
					],
					externalEmailEnabled: true,
				},
			);
		}

		const marked = await deps.backends.markActive(projectId, {
			anonKey,
			dbHost,
			lastActiveAt: new Date(deps.now()),
		});
		if (!marked) {
			// The project was deleted during provisioning: the row stays
			// `deleting`, and the pause sweep deletes the Supabase project.
			deps.logger.info("supabase.provisioning.skipped", {
				projectId,
				reason: "status-deleting",
			});
			return { outcome: "skipped", failureCode: null };
		}
		// LIMIT: a sandbox that already runs gets the env values at its next
		// resume. Upgrade: write the sandbox .env and restart the dev server
		// (issue step 8, `writeBackendEnvToSandbox`).
		try {
			await deps.auditEvents.insert({
				action: "backend.provisioned",
				actorUserId: null,
				metadata: { ref, region: row.region },
				organizationId: row.organizationId,
				projectId,
				targetId: row.id,
				targetType: "app_backend",
			});
		} catch (error) {
			// The audit row is a trail, not a gate: a failed insert never
			// turns an active backend into an error.
			deps.logger.error("supabase.provisioning.audit-failed", {
				projectId,
				ref,
				error: getErrorMessage(error),
			});
		}
		deps.logger.info("supabase.provisioning.active", {
			projectId,
			ref,
			elapsedMs: String(deps.now() - startedAt),
		});
		return { outcome: "active", failureCode: null };
	} catch (error) {
		return fail(deps, {
			error,
			failureCode: "backend_provision_failed",
			projectId,
			ref,
		});
	}
}

/**
 * One failure path for every step. A `SupabaseManagementError` fills kind,
 * source, provider, message, and request id from the error. Any other
 * error takes the step's kind and source. Always captures to Sentry,
 * stores the row, logs, and answers the error outcome.
 */
async function fail(
	deps: ProvisionBackendDeps,
	input: {
		projectId: string;
		ref: string | null;
		failureCode: string;
		/** Kind for a non-Supabase error; default `internal`. */
		failureKind?: AppBackendFailure["failureKind"];
		/** Source for a non-Supabase error; default `task`. */
		failureSource?: AppBackendFailure["failureSource"];
		/** Provider message for a non-Supabase error, for example the terminal status. */
		failureProviderMessage?: string | null;
		error: unknown;
	},
): Promise<ProvisionBackendResult> {
	const { error } = input;
	const isManagementError = error instanceof SupabaseManagementError;
	const failure: AppBackendFailure = {
		error: getErrorMessage(error),
		failureCode: input.failureCode,
		failureKind: isManagementError
			? "provider"
			: (input.failureKind ?? "internal"),
		failureSource: isManagementError
			? error.status === null
				? "network"
				: "supabase_api"
			: (input.failureSource ?? "task"),
		failureProvider: isManagementError ? "supabase" : null,
		failureProviderMessage: isManagementError
			? error.detail
			: (input.failureProviderMessage ?? null),
		failureRequestId: isManagementError ? error.requestId : null,
		sentryEventId:
			deps.captureException(error, {
				projectId: input.projectId,
				ref: input.ref,
			}) ?? null,
	};
	try {
		await deps.backends.markError(input.projectId, failure);
	} catch (markError) {
		deps.logger.error("supabase.provisioning.mark-error-failed", {
			projectId: input.projectId,
			error: getErrorMessage(markError),
		});
	}
	deps.logger.error("supabase.provisioning.failed", {
		projectId: input.projectId,
		ref: input.ref ?? "none",
		failureCode: input.failureCode,
	});
	return { outcome: "error", failureCode: input.failureCode };
}

/**
 * Composes the real repositories, the Management API client, the base-SQL
 * reader, the Trigger wait, and the Sentry capture for the worker. `close`
 * quits the rate limiter's Redis client; the task ends the pool itself.
 */
export function createProvisionBackendRuntime(db: TriggerDatabase): {
	run(input: ProvisionBackendInput): Promise<ProvisionBackendResult>;
	close(): Promise<void>;
} {
	const backends = new AppBackendsRepository(db);
	const { client, close } = supabaseWorkerClientFromEnv(
		env,
		backends,
		Sentry.logger,
	);
	return {
		run: (input) =>
			runProvisionBackend(
				{
					auditEvents: new AuditEventsRepository(db),
					backends,
					captureException: (error, tags) =>
						Sentry.captureException(error, {
							tags: { projectId: tags.projectId, ref: tags.ref ?? "none" },
						}),
					client,
					instanceSize: instanceSizeFromEnv(
						env.SUPABASE_PLATFORM_INSTANCE_SIZE,
						Sentry.logger,
					),
					logger: Sentry.logger,
					now: Date.now,
					previewDomain: env.PREVIEW_DOMAIN ?? null,
					readBaseSql: () =>
						readFile(
							resolve(TEMPLATE_ARCHIVE_DIR, BASE_SQL_RELATIVE_PATH),
							"utf8",
						),
					// A Trigger wait frees the machine during the 10 minute poll.
					sleep: (ms) => wait.for({ seconds: ms / 1000 }),
				},
				input,
			),
		close,
	};
}
