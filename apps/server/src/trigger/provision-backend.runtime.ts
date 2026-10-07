/**
 * Provision-backend runtime: creates the hidden Supabase project of one
 * V2 app and walks its `app_backends` row to `active` (WANDIT-183, D18).
 * The steps run in order: claim the `creating` row by `requestKey`.
 * Reuse the project of a retried row, or clean a dead one. Adopt a live
 * project whose create answer was lost. Else store the database password
 * and create the project. Poll
 * to `ACTIVE_HEALTHY`, with one restore of a paused project. Read the keys
 * and store the service-role key. Apply the base schema. Set the auth
 * config. Mark active. Write the `.env` of a running sandbox. Write the
 * audit row. It calls `AppBackendsRepository`, `SupabaseManagementClient`,
 * `ProjectSecretsService`, `SandboxProvider.findRunning`,
 * `AuditEventsRepository`, and Sentry. `provision-backend.task.ts` calls it
 * through `createProvisionBackendRuntime`; the spec runs
 * `runProvisionBackend` on fakes. No Nest here: Trigger workers compose
 * dependencies by hand.
 */
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { wait } from "@trigger.dev/sdk";
import {
	previewAuthRedirectPattern,
	type SupabaseInstanceSize,
	supabaseInstanceSizeSchema,
	supabaseProjectUrl,
	supabaseRegionSchema,
} from "@wandit/contracts";
import type { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/node";

import {
	ProjectSecretsService,
	type SecretActor,
	SUPABASE_DB_PASSWORD_SECRET,
	SUPABASE_SERVICE_ROLE_KEY_SECRET,
} from "../modules/app-builder/application/services/project-secrets.service";
import type {
	SandboxLogger,
	SandboxProvider,
} from "../modules/app-builder/domain/ports/sandbox-provider";
import { LoggingRepoRestorer } from "../modules/app-builder/infrastructure/git/logging-repo-restorer";
import type { AppBackendFailure } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { AppBackendsRepository } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { AuditEventsRepository } from "../modules/app-builder/infrastructure/persistence/audit-events.repository";
import { ProjectSecretsRepository } from "../modules/app-builder/infrastructure/persistence/project-secrets.repository";
import { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import { syncBackendEnvFile } from "../modules/app-builder/infrastructure/sandbox/sandbox-env";
import {
	ArchiveTemplateInit,
	TEMPLATE_ARCHIVE_DIR,
} from "../modules/app-builder/infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/vercel-sandbox.provider";
import {
	projectStatusOrRemoved,
	type SupabaseManagementClient,
	SupabaseManagementError,
	supabaseWorkerClientFromEnv,
} from "../modules/app-builder/infrastructure/supabase/supabase-management.client";
import { ProjectsRepository } from "../modules/projects/infrastructure/persistence/projects.repository";

type TriggerDatabase = ReturnType<typeof createDb>;

// Issue step 4: one status poll every 5 s.
const POLL_INTERVAL_MS = 5_000;
// Issue step 4: the poll gives up after 10 minutes.
const POLL_TIMEOUT_MS = 600_000;
// The WANDIT-168 base schema under `TEMPLATE_ARCHIVE_DIR`; it enables
// pg_cron and creates `public.profiles` with RLS. It is platform-neutral,
// so it serves the web-app and the mobile-app backends.
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
	/** Reads and marks the `app_backends` row; the API ran `writeCreatingWithinLimit`. */
	backends: Pick<
		AppBackendsRepository,
		| "findByProjectId"
		| "markCreated"
		| "markActive"
		| "markError"
		| "setSecretId"
	>;
	/** Stores the database password and the service-role key as encrypted `system` rows. */
	secrets: Pick<ProjectSecretsService, "set">;
	/** Append-only writer of the `backend.provisioned` audit row. */
	auditEvents: Pick<AuditEventsRepository, "insert">;
	/** Finds the project's sandbox only when it runs now; a stopped one stays stopped. */
	sandboxes: Pick<SandboxProvider, "findRunning">;
	/**
	 * Management API client. Null when the worker env lacks
	 * `SUPABASE_PLATFORM_TOKEN` or `SUPABASE_PLATFORM_ORG_ID`; the run then
	 * fails `backend_provision_unconfigured`.
	 */
	client: Pick<
		SupabaseManagementClient,
		| "createProject"
		| "deleteProject"
		| "findLiveProjectRef"
		| "getProject"
		| "getApiKeys"
		| "getServiceRoleKey"
		| "restoreProject"
		| "runSql"
		| "updateAuthConfig"
	> | null;
	/** `desired_instance_size` of the create call, from `SUPABASE_PLATFORM_INSTANCE_SIZE`. */
	instanceSize: SupabaseInstanceSize;
	/** `env.PREVIEW_DOMAIN`; null skips only the auth URL fields, not the email settings. */
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
	const { projectId, requestKey } = input;
	const row = await deps.backends.findByProjectId(projectId);
	if (
		row === null ||
		row.status !== "creating" ||
		row.requestKey !== requestKey
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
			requestKey,
		});
	}
	const client = deps.client;

	// The writes of the run carry the owner of the row; a task has no IP.
	const actor: SecretActor = {
		ip: null,
		scope:
			row.organizationId === null
				? { kind: "personal", userId: row.userId }
				: {
						actorIsLimitExempt: false,
						kind: "org",
						organizationId: row.organizationId,
						userId: row.userId,
					},
	};
	let ref = row.ref;
	const startedAt = deps.now();
	try {
		if (ref !== null) {
			// A retry of an `error` row, or a replay, finds the ref stored. A
			// live or paused project is reused, so a replay creates no second
			// project. A dead one goes first, so a retry leaves no paid orphan.
			const storedRef = ref;
			const status = await projectStatusOrRemoved(client, {
				projectId,
				ref: storedRef,
			});
			if (status === "INIT_FAILED" && row.anonKey === null) {
				// The row never went active, so the project holds no data of the
				// user. A project that served the app stays for an operator: the
				// poll below fails the run on INIT_FAILED.
				await client.deleteProject({ projectId, ref: storedRef });
				ref = null;
			} else if (status === "REMOVED") {
				ref = null;
			}
			deps.logger.info(
				ref === null
					? "supabase.provisioning.replaced"
					: "supabase.provisioning.resumed",
				{ projectId, ref: storedRef, status },
			);
		}

		if (ref === null) {
			// A create call whose answer was lost (a timeout after Supabase
			// committed) left a live project on no row. Adopt it with the
			// password stored before that call, so no second paid project starts.
			const adoptedRef = await client.findLiveProjectRef(projectId);
			if (adoptedRef !== null) {
				if (
					!(await deps.backends.markCreated(projectId, requestKey, {
						orgId: row.orgId,
						ref: adoptedRef,
					}))
				) {
					deps.logger.info("supabase.provisioning.skipped", {
						projectId,
						reason: "row-moved",
					});
					return { outcome: "skipped", failureCode: null };
				}
				ref = adoptedRef;
				deps.logger.warn("supabase.provisioning.adopted", {
					projectId,
					ref,
				});
			}
		}

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
					requestKey,
				});
			}
			// 32 random bytes as base64url = 43 characters. The password is
			// never logged. It is stored before the create call: no project
			// may exist without its stored password.
			const dbPassword = randomBytes(32).toString("base64url");
			const passwordSecretId = await deps.secrets.set(
				projectId,
				SUPABASE_DB_PASSWORD_SECRET,
				dbPassword,
				"system",
				actor,
			);
			await deps.backends.setSecretId(
				projectId,
				"dbPasswordSecretId",
				passwordSecretId,
			);
			const created = await client.createProject({
				projectId,
				region: region.data,
				dbPassword,
				instanceSize: deps.instanceSize,
			});
			if (!(await deps.backends.markCreated(projectId, requestKey, created))) {
				// A retry gave the row a new request key during the create call.
				// The client can no longer reach this ref, so an operator must
				// delete the project: Sentry gets the ref.
				deps.captureException(
					new Error(`orphan supabase project ${created.ref}: row moved`),
					{ projectId, ref: created.ref },
				);
				deps.logger.error("supabase.provisioning.orphan-project", {
					projectId,
					ref: created.ref,
				});
				return { outcome: "skipped", failureCode: null };
			}
			ref = created.ref;
			deps.logger.info("supabase.provisioning.created", {
				projectId,
				ref,
				region: row.region,
			});
		}

		// The loop exits through `break` on ACTIVE_HEALTHY or through `fail`
		// on a terminal status or the deadline — never through the header.
		let dbHost = "";
		let restoreSent = false;
		while (true) {
			const project = await client.getProject({ projectId, ref });
			if (project.status === "ACTIVE_HEALTHY") {
				dbHost = project.dbHost;
				break;
			}
			// A retried row can hold a project that the sweep paused or whose
			// wake failed. One restore call brings it back with its data.
			if (
				!restoreSent &&
				(project.status === "INACTIVE" || project.status === "RESTORE_FAILED")
			) {
				await client.restoreProject({ projectId, ref });
				restoreSent = true;
				await deps.sleep(POLL_INTERVAL_MS);
				continue;
			}
			// After the restore call Supabase can still answer RESTORE_FAILED for
			// a while, so only the deadline ends that wait.
			if (project.status === "INIT_FAILED" || project.status === "REMOVED") {
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
					requestKey,
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
					requestKey,
				});
			}
			await deps.sleep(POLL_INTERVAL_MS);
		}

		const { anonKey } = await client.getApiKeys({ projectId, ref });
		// The Cloud storage routes read the stored key instead of one
		// Management API call per request. It is stored before `active`.
		const serviceRoleSecretId = await deps.secrets.set(
			projectId,
			SUPABASE_SERVICE_ROLE_KEY_SECRET,
			await client.getServiceRoleKey({ projectId, ref }),
			"system",
			actor,
		);
		await deps.backends.setSecretId(
			projectId,
			"serviceRoleSecretId",
			serviceRoleSecretId,
		);

		// A reused project that was active before holds the schema and the auth
		// settings that the app and the agent changed since. Only a new project,
		// or one that never went active, gets the base schema and the auth config.
		if (ref !== row.ref || row.anonKey === null) {
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
					requestKey,
				});
			}
			await client.runSql({ projectId, ref }, baseSql);

			// Product rule: a new app account works at sign-up, with no
			// confirmation email. This needs no PREVIEW_DOMAIN, so it always goes out.
			const emailSettings = {
				externalEmailEnabled: true,
				skipEmailConfirmation: true,
			};
			if (deps.previewDomain === null) {
				deps.logger.warn("supabase.provisioning.auth-urls-skipped", {
					projectId,
					ref,
				});
				await client.updateAuthConfig({ projectId, ref }, emailSettings);
			} else {
				// Provisioning sets the preview apex as `site_url` at creation.
				// `BackendAuthUrlsService` replaces it after the first publish or a
				// domain change.
				await client.updateAuthConfig(
					{ projectId, ref },
					{
						...emailSettings,
						siteUrl: `https://${deps.previewDomain}`,
						uriAllowList: [
							previewAuthRedirectPattern(projectId, deps.previewDomain),
						],
					},
				);
			}
		} else {
			deps.logger.info("supabase.provisioning.setup-kept", { projectId, ref });
		}

		const marked = await deps.backends.markActive(projectId, requestKey, {
			anonKey,
			dbHost,
			lastActiveAt: new Date(deps.now()),
		});
		if (!marked) {
			// The project was deleted during provisioning: the row stays
			// `deleting`, and the pause sweep deletes the Supabase project. Or
			// a retry gave the row a new key, and the new run owns this ref.
			deps.logger.info("supabase.provisioning.skipped", {
				projectId,
				reason: "row-moved",
			});
			return { outcome: "skipped", failureCode: null };
		}
		// The app in a running sandbox gets the values now. A stopped sandbox
		// stays stopped: its next turn writes the file.
		// The egress policy is not pushed from here: a push from this process
		// deletes the proxy run-token rule of the harness session. A turn with
		// a fresh session adds the backend host on its keep-alive tick
		// (`builder-turn.runtime.ts`). A resumed turn and an idle sandbox get it
		// at the next turn start.
		try {
			const sandbox = await deps.sandboxes.findRunning(projectId);
			if (sandbox !== null) {
				await syncBackendEnvFile(sandbox, {
					anonKey,
					url: supabaseProjectUrl(ref),
				});
			}
		} catch (error) {
			// A failed write never turns an active backend into an error. A
			// missing file gets its write at the next turn.
			deps.logger.warn("supabase.provisioning.env-file-failed", {
				projectId,
				ref,
				error: getErrorMessage(error),
			});
		}
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
			requestKey,
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
		/** Request key of the run; the row write applies only while the row holds it. */
		requestKey: string;
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
		await deps.backends.markError(input.projectId, input.requestKey, failure);
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
	const auditEvents = new AuditEventsRepository(db);
	// The `.env` write only calls `findRunning`, which never restores a repo
	// or applies a template, like the idle sweep.
	const sandboxes = new VercelSandboxProvider(
		new SandboxSessionsRepository(db),
		new LoggingRepoRestorer(),
		new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
	);
	return {
		run: (input) =>
			runProvisionBackend(
				{
					auditEvents,
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
					sandboxes,
					secrets: new ProjectSecretsService(
						new ProjectSecretsRepository(db),
						new ProjectsRepository(db),
						auditEvents,
						env,
					),
					// A Trigger wait frees the machine during the 10 minute poll.
					sleep: (ms) => wait.for({ seconds: ms / 1000 }),
				},
				input,
			),
		close,
	};
}
