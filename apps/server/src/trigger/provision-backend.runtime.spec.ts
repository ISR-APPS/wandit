import {
	previewAuthRedirectPattern,
	type SupabaseInstanceSize,
	type SupabaseProjectStatus,
	type SupabaseRegion,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { SandboxLogger } from "../modules/app-builder/domain/ports/sandbox-provider";
import type {
	AppBackendFailure,
	AppBackendRow,
} from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import type { AuditEventInput } from "../modules/app-builder/infrastructure/persistence/audit-events.repository";
import {
	FAKE_WORKSPACE_DIR,
	FakeSandboxProvider,
} from "../modules/app-builder/infrastructure/sandbox/fake-sandbox.provider";
import {
	jsonResponse,
	type RecordedRequest,
	scriptedFetch,
} from "../modules/app-builder/infrastructure/supabase/fake-supabase-fetch";
import { FakeSupabaseRateLimiter } from "../modules/app-builder/infrastructure/supabase/fake-supabase-rate-limiter";
import type {
	BackendRef,
	ConfirmationEmailSender,
} from "../modules/app-builder/infrastructure/supabase/supabase-management.client";
import {
	SupabaseManagementClient,
	SupabaseManagementError,
} from "../modules/app-builder/infrastructure/supabase/supabase-management.client";
import {
	instanceSizeFromEnv,
	type ProvisionBackendDeps,
	runProvisionBackend,
} from "./provision-backend.runtime";

const PROJECT_ID = "project-1";
const REQUEST_KEY = "req-key-1";
const REF = "abcdefghijklmnopqrst";
const ORG_ID = "org_123";
const DB_HOST = "db.abcdefghijklmnopqrst.supabase.co";
const ANON_KEY = "anon-key-1";
const SERVICE_ROLE_KEY = "service-role-key-1";
const BASE_SQL = "create extension if not exists pg_cron;";
const PREVIEW_DOMAIN = "preview.test";
const EMAIL_FROM = "no-reply@auth.test";
const RESEND_KEY = "re_test_key_1";
// A project whose template has the code step on its login page.
const PROJECT = { name: "Nour Objets", templateVersion: "web-app@1.2.0" };

const INPUT = { projectId: PROJECT_ID, requestKey: REQUEST_KEY };

// The options a builder turn boots the fake sandbox with; only the project id matters here.
const SANDBOX_OPTIONS = {
	devCommand: "pnpm run dev",
	devPort: 8081,
	env: {},
	framework: "mobile-app",
	organizationId: null,
	ownerUserId: "user-1",
	templateVersion: "mobile-app@1.1.0",
};

type CreateProjectCall = {
	projectId: string;
	region: SupabaseRegion;
	dbPassword: string;
	instanceSize: SupabaseInstanceSize;
};

type AuthConfigCall = {
	scope: BackendRef;
	input: {
		siteUrl?: string;
		uriAllowList?: string[];
		externalEmailEnabled: boolean;
		confirmationEmail: ConfirmationEmailSender | null;
	};
};

function backendRow(overrides: Partial<AppBackendRow> = {}): AppBackendRow {
	return {
		anonKey: null,
		dbHost: null,
		failureCode: null,
		id: "backend-1",
		orgId: null,
		organizationId: "org-1",
		projectId: PROJECT_ID,
		ref: null,
		region: "eu-west-3",
		requestKey: REQUEST_KEY,
		status: "creating",
		triggerRunId: null,
		userId: "user-1",
		...overrides,
	};
}

// In-memory `app_backends` repository: one row per project id, every
// markError input and every stored secret id recorded for assertions.
// Like the repository, each run write applies only while the row holds
// the run's request key.
function createBackendsFake(row: AppBackendRow | null) {
	const rows = new Map<string, AppBackendRow>();
	if (row) {
		rows.set(row.projectId, row);
	}
	const failures: { projectId: string; failure: AppBackendFailure }[] = [];
	const secretIds = new Map<string, string>();
	const ownedBy = (projectId: string, requestKey: string) => {
		const stored = rows.get(projectId);
		return stored?.requestKey === requestKey ? stored : undefined;
	};
	return {
		failures,
		secretIds,
		findByProjectId: vi.fn(
			async (projectId: string) => rows.get(projectId) ?? null,
		),
		markCreated: vi.fn(
			async (
				projectId: string,
				requestKey: string,
				input: { ref: string; orgId: string | null },
			) => {
				const stored = ownedBy(projectId, requestKey);
				if (stored === undefined) {
					return false;
				}
				stored.ref = input.ref;
				stored.orgId = input.orgId;
				return true;
			},
		),
		markActive: vi.fn(
			async (
				projectId: string,
				requestKey: string,
				input: { anonKey: string; dbHost: string; lastActiveAt: Date },
			) => {
				const stored = ownedBy(projectId, requestKey);
				// Like the repository: a `deleting` row stays and answers false.
				if (stored === undefined || stored.status === "deleting") {
					return false;
				}
				stored.status = "active";
				stored.anonKey = input.anonKey;
				stored.dbHost = input.dbHost;
				return true;
			},
		),
		markError: vi.fn(
			async (
				projectId: string,
				requestKey: string,
				failure: AppBackendFailure,
			) => {
				const stored = ownedBy(projectId, requestKey);
				if (stored) {
					stored.status = "error";
					stored.failureCode = failure.failureCode;
				}
				failures.push({ projectId, failure });
			},
		),
		setSecretId: vi.fn(
			async (
				_projectId: string,
				column: "serviceRoleSecretId" | "dbPasswordSecretId",
				secretId: string,
			) => {
				secretIds.set(column, secretId);
			},
		),
	};
}

// `ProjectSecretsService.set` fake: keeps the plain values by name and
// answers a row id per name, like the upsert on (project, name).
function createSecretsFake() {
	const values = new Map<string, { value: string; kind: string }>();
	return {
		values,
		set: vi.fn(
			async (
				_projectId: string,
				name: string,
				value: string,
				kind: "user" | "system",
			) => {
				values.set(name, { kind, value });
				return `secret-${name}`;
			},
		),
	};
}

// Management client fake: `getProject` answers the scripted statuses in
// order and "COMING_UP" once the queue is empty.
function createClientFake(statuses: SupabaseProjectStatus[]) {
	const createCalls: CreateProjectCall[] = [];
	const getCalls: BackendRef[] = [];
	const sqlCalls: { scope: BackendRef; sql: string }[] = [];
	const authCalls: AuthConfigCall[] = [];
	return {
		authCalls,
		createCalls,
		getCalls,
		sqlCalls,
		createProject: vi.fn(async (input: CreateProjectCall) => {
			createCalls.push(input);
			return { ref: REF, orgId: ORG_ID };
		}),
		getProject: vi.fn(async (scope: BackendRef) => {
			getCalls.push(scope);
			return { status: statuses.shift() ?? "COMING_UP", dbHost: DB_HOST };
		}),
		getApiKeys: vi.fn(async (_scope: BackendRef) => ({ anonKey: ANON_KEY })),
		getServiceRoleKey: vi.fn(async (_scope: BackendRef) => SERVICE_ROLE_KEY),
		// Default: no live project of this name exists yet.
		findLiveProjectRef: vi.fn(
			async (_projectId: string): Promise<string | null> => null,
		),
		deleteProject: vi.fn(async (_scope: BackendRef) => undefined),
		restoreProject: vi.fn(async (_scope: BackendRef) => undefined),
		runSql: vi.fn(async (scope: BackendRef, sql: string) => {
			sqlCalls.push({ scope, sql });
		}),
		updateAuthConfig: vi.fn(
			async (scope: BackendRef, input: AuthConfigCall["input"]) => {
				authCalls.push({ scope, input });
			},
		),
	};
}

function setup(
	row: AppBackendRow | null,
	options: {
		statuses?: SupabaseProjectStatus[];
		previewDomain?: string | null;
		noClient?: boolean;
		/** `APP_AUTH_EMAIL_FROM` of the worker. Default: unset. */
		appAuthEmailFrom?: string;
		/** `RESEND_PLATFORM_API_KEY` of the worker. Default: unset. */
		resendPlatformApiKey?: string;
		/** The project row; null means that no row exists. Default: `PROJECT`. */
		project?: { name: string; templateVersion: string | null } | null;
	} = {},
) {
	const backends = createBackendsFake(row);
	const audits: AuditEventInput[] = [];
	const sleeps: number[] = [];
	const logs: {
		level: "error" | "info" | "warn";
		message: string;
		fields: Record<string, string>;
	}[] = [];
	const captures: {
		error: unknown;
		tags: { projectId: string; ref: string | null };
	}[] = [];
	const client = createClientFake(options.statuses ?? []);
	const logger: SandboxLogger = {
		error: (message, fields) => {
			logs.push({ level: "error", message, fields });
		},
		info: (message, fields) => {
			logs.push({ level: "info", message, fields });
		},
		warn: (message, fields) => {
			logs.push({ level: "warn", message, fields });
		},
	};
	let fakeNow = 0;
	const sandboxes = new FakeSandboxProvider();
	const secrets = createSecretsFake();
	const project = options.project === undefined ? PROJECT : options.project;
	const deps = {
		appAuthEmailFrom: options.appAuthEmailFrom ?? null,
		auditEvents: {
			insert: vi.fn(async (input: AuditEventInput) => {
				audits.push(input);
			}),
		},
		backends,
		captureException: (
			error: unknown,
			tags: { projectId: string; ref: string | null },
		) => {
			captures.push({ error, tags });
			return "evt-1";
		},
		client: options.noClient ? null : client,
		instanceSize: "micro" as const,
		logger,
		now: () => fakeNow,
		previewDomain:
			options.previewDomain === undefined
				? PREVIEW_DOMAIN
				: options.previewDomain,
		projects: { findProject: async (_projectId: string) => project },
		readBaseSql: vi.fn(async () => BASE_SQL),
		resendPlatformApiKey: options.resendPlatformApiKey ?? null,
		sandboxes,
		secrets,
		sleep: async (ms: number) => {
			sleeps.push(ms);
			fakeNow += ms;
		},
	} satisfies ProvisionBackendDeps;

	return {
		audits,
		backends,
		captures,
		client,
		deps,
		logs,
		sandboxes,
		secrets,
		sleeps,
	};
}

describe("runProvisionBackend", () => {
	it("creates the project, polls to healthy, and marks the row active", async () => {
		const { audits, backends, client, deps, logs, secrets, sleeps } = setup(
			backendRow(),
			{ statuses: ["COMING_UP", "COMING_UP", "ACTIVE_HEALTHY"] },
		);

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({ outcome: "active", failureCode: null });
		const create = client.createCalls[0];
		expect(create?.projectId).toBe(PROJECT_ID);
		expect(create?.region).toBe("eu-west-3");
		expect(create?.instanceSize).toBe("micro");
		const dbPassword = create?.dbPassword ?? "";
		expect(dbPassword).toHaveLength(43);
		expect(backends.markCreated).toHaveBeenCalledWith(PROJECT_ID, REQUEST_KEY, {
			ref: REF,
			orgId: ORG_ID,
		});
		// Both keys land as encrypted `system` rows, and the row points at them.
		expect(Object.fromEntries(secrets.values)).toEqual({
			SUPABASE_DB_PASSWORD: { kind: "system", value: dbPassword },
			SUPABASE_SERVICE_ROLE_KEY: { kind: "system", value: SERVICE_ROLE_KEY },
		});
		expect(Object.fromEntries(backends.secretIds)).toEqual({
			dbPasswordSecretId: "secret-SUPABASE_DB_PASSWORD",
			serviceRoleSecretId: "secret-SUPABASE_SERVICE_ROLE_KEY",
		});
		expect(client.getCalls).toEqual([
			{ projectId: PROJECT_ID, ref: REF },
			{ projectId: PROJECT_ID, ref: REF },
			{ projectId: PROJECT_ID, ref: REF },
		]);
		expect(sleeps).toEqual([5_000, 5_000]);
		expect(client.getApiKeys).toHaveBeenCalledWith({
			projectId: PROJECT_ID,
			ref: REF,
		});
		expect(client.sqlCalls).toEqual([
			{ scope: { projectId: PROJECT_ID, ref: REF }, sql: BASE_SQL },
		]);
		expect(client.authCalls).toEqual([
			{
				scope: { projectId: PROJECT_ID, ref: REF },
				input: {
					siteUrl: `https://${PREVIEW_DOMAIN}`,
					uriAllowList: [
						previewAuthRedirectPattern(PROJECT_ID, PREVIEW_DOMAIN),
					],
					externalEmailEnabled: true,
					confirmationEmail: null,
				},
			},
		]);
		// Security: a `*` or `?` before the path also matches `@`, so a login
		// token could go to another host. Only the path may hold a glob.
		const [redirectHost] =
			client.authCalls[0]?.input.uriAllowList?.[0]?.split("/**") ?? [];
		expect(redirectHost).toMatch(/^https:\/\/[^*?]+$/);
		expect(backends.markActive).toHaveBeenCalledWith(PROJECT_ID, REQUEST_KEY, {
			anonKey: ANON_KEY,
			dbHost: DB_HOST,
			lastActiveAt: expect.any(Date),
		});
		expect(audits).toEqual([
			{
				action: "backend.provisioned",
				actorUserId: null,
				metadata: { ref: REF, region: "eu-west-3" },
				organizationId: "org-1",
				projectId: PROJECT_ID,
				targetId: "backend-1",
				targetType: "app_backend",
			},
		]);
		// No log line may carry the password, the service-role key, or the anon key.
		const logged = logs
			.map((line) => `${line.message} ${JSON.stringify(line.fields)}`)
			.join("\n");
		expect(logged).not.toContain(dbPassword);
		expect(logged).not.toContain(SERVICE_ROLE_KEY);
		expect(logged).not.toContain(ANON_KEY);
	});

	it("times out after 10 minutes of polling", async () => {
		const { backends, captures, deps } = setup(backendRow(), {
			// An empty script answers "COMING_UP" forever.
			statuses: [],
		});

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({
			outcome: "error",
			failureCode: "backend_provision_timeout",
		});
		expect(backends.markError).toHaveBeenCalledTimes(1);
		const failure = backends.failures[0]?.failure;
		expect(failure?.failureKind).toBe("timeout");
		expect(failure?.failureSource).toBe("supabase_api");
		expect(failure?.sentryEventId).toBe("evt-1");
		expect(captures[0]?.tags).toEqual({ projectId: PROJECT_ID, ref: REF });
		expect(deps.now()).toBe(600_000);
	});

	it("reuses a stored ref that runs and creates no second project", async () => {
		const { client, deps } = setup(backendRow({ ref: REF, orgId: ORG_ID }), {
			statuses: ["ACTIVE_HEALTHY", "ACTIVE_HEALTHY"],
		});

		const result = await runProvisionBackend(deps, INPUT);

		expect(result.outcome).toBe("active");
		expect(client.createProject).not.toHaveBeenCalled();
		expect(client.deleteProject).not.toHaveBeenCalled();
	});

	it("adopts a live project whose create answer was lost and creates no second project", async () => {
		const { backends, client, deps, secrets } = setup(backendRow(), {
			statuses: ["ACTIVE_HEALTHY"],
		});
		client.findLiveProjectRef.mockResolvedValueOnce(REF);

		const result = await runProvisionBackend(deps, INPUT);

		expect(result.outcome).toBe("active");
		expect(client.createProject).not.toHaveBeenCalled();
		// The password of the lost call stays: no new password replaces it.
		expect(secrets.values.has("SUPABASE_DB_PASSWORD")).toBe(false);
		expect((await backends.findByProjectId(PROJECT_ID))?.ref).toBe(REF);
	});

	it("keeps an INIT_FAILED project of a row that went active before and fails the run", async () => {
		const { client, deps } = setup(
			backendRow({ anonKey: "old-anon-key", ref: REF, orgId: ORG_ID }),
			{ statuses: ["INIT_FAILED", "INIT_FAILED"] },
		);

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({
			outcome: "error",
			failureCode: "backend_provision_failed",
		});
		expect(client.deleteProject).not.toHaveBeenCalled();
		expect(client.createProject).not.toHaveBeenCalled();
	});

	it("keeps the schema and the auth config of a reused project that was active before", async () => {
		// A failed wake of an app with data: its migrations and auth URLs stay.
		const { client, deps } = setup(
			backendRow({ anonKey: "old-anon-key", ref: REF, orgId: ORG_ID }),
			{ statuses: ["ACTIVE_HEALTHY", "ACTIVE_HEALTHY"] },
		);

		const result = await runProvisionBackend(deps, INPUT);

		expect(result.outcome).toBe("active");
		expect(client.runSql).not.toHaveBeenCalled();
		expect(client.updateAuthConfig).not.toHaveBeenCalled();
	});

	it("waits on RESTORE_FAILED after its restore call until Supabase moves on", async () => {
		const { client, deps } = setup(
			backendRow({ anonKey: "old-anon-key", ref: REF, orgId: ORG_ID }),
			{
				// Reuse check, the read that sends the restore, then one stale read.
				statuses: [
					"RESTORE_FAILED",
					"RESTORE_FAILED",
					"RESTORE_FAILED",
					"RESTORING",
					"ACTIVE_HEALTHY",
				],
			},
		);

		const result = await runProvisionBackend(deps, INPUT);

		expect(result.outcome).toBe("active");
		expect(client.restoreProject).toHaveBeenCalledTimes(1);
	});

	it("restores a paused project of a retried row once and reaches active", async () => {
		const { client, deps } = setup(backendRow({ ref: REF, orgId: ORG_ID }), {
			// The first read is the reuse check; then the poll.
			statuses: ["INACTIVE", "INACTIVE", "RESTORING", "ACTIVE_HEALTHY"],
		});

		const result = await runProvisionBackend(deps, INPUT);

		expect(result.outcome).toBe("active");
		expect(client.restoreProject).toHaveBeenCalledTimes(1);
		expect(client.createProject).not.toHaveBeenCalled();
	});

	it.each([
		{ deleted: true, old: "INIT_FAILED" },
		{ deleted: false, old: "REMOVED" },
		{ deleted: false, old: "404" },
	] as const)("replaces a dead $old project of a retried row with one new project", async ({
		deleted,
		old,
	}) => {
		const deadRef = "zyxwvutsrqponmlkjihg";
		const { backends, client, deps } = setup(
			backendRow({ ref: deadRef, orgId: ORG_ID }),
			{
				statuses: old === "404" ? ["ACTIVE_HEALTHY"] : [old, "ACTIVE_HEALTHY"],
			},
		);
		if (old === "404") {
			client.getProject.mockRejectedValueOnce(
				new SupabaseManagementError("not found", 404, "req-1", null),
			);
		}

		const result = await runProvisionBackend(deps, INPUT);

		expect(result.outcome).toBe("active");
		expect(client.deleteProject).toHaveBeenCalledTimes(deleted ? 1 : 0);
		expect(client.createProject).toHaveBeenCalledTimes(1);
		expect((await backends.findByProjectId(PROJECT_ID))?.ref).toBe(REF);
	});

	it("reports the new project as an orphan when a retry took the row during the create call", async () => {
		const { backends, captures, client, deps } = setup(backendRow());
		client.createProject.mockImplementationOnce(async () => {
			// A retry gives the row a new request key while the call runs.
			const stored = await backends.findByProjectId(PROJECT_ID);
			if (stored) {
				stored.requestKey = "req-key-2";
			}
			return { orgId: ORG_ID, ref: REF };
		});

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({ outcome: "skipped", failureCode: null });
		expect(captures[0]?.tags).toEqual({ projectId: PROJECT_ID, ref: REF });
		expect(client.getProject).not.toHaveBeenCalled();
		expect(backends.markActive).not.toHaveBeenCalled();
	});

	it("answers skipped and writes no audit row when the project was deleted during provisioning", async () => {
		const { audits, backends, deps } = setup(backendRow(), {
			statuses: ["ACTIVE_HEALTHY"],
		});
		backends.markActive.mockResolvedValue(false);

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({ outcome: "skipped", failureCode: null });
		expect(audits).toEqual([]);
		expect(backends.markError).not.toHaveBeenCalled();
	});

	it("answers skipped on a row that already left creating", async () => {
		const { backends, client, deps } = setup(
			backendRow({ status: "active", ref: REF }),
		);

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({ outcome: "skipped", failureCode: null });
		expect(client.createProject).not.toHaveBeenCalled();
		expect(client.getProject).not.toHaveBeenCalled();
		expect(backends.markActive).not.toHaveBeenCalled();
		expect(backends.markError).not.toHaveBeenCalled();
	});

	it("answers skipped when the row carries another requestKey", async () => {
		const { client, deps } = setup(backendRow({ requestKey: "other-key" }));

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({ outcome: "skipped", failureCode: null });
		expect(client.createProject).not.toHaveBeenCalled();
	});

	it("fails unconfigured when the worker env has no client", async () => {
		const { backends, deps } = setup(backendRow(), { noClient: true });

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({
			outcome: "error",
			failureCode: "backend_provision_unconfigured",
		});
		expect(backends.failures[0]?.failure.failureKind).toBe("config");
		expect(backends.failures[0]?.failure.failureSource).toBe("task");
	});

	it("fails config when the row region is not a Supabase region", async () => {
		const { backends, client, deps } = setup(backendRow({ region: "mars-1" }));

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({
			outcome: "error",
			failureCode: "backend_provision_failed",
		});
		const failure = backends.failures[0]?.failure;
		expect(failure?.failureKind).toBe("config");
		expect(failure?.failureSource).toBe("task");
		expect(client.createProject).not.toHaveBeenCalled();
	});

	it("fails provider on a terminal provider status", async () => {
		const { backends, deps } = setup(backendRow(), {
			statuses: ["COMING_UP", "INIT_FAILED"],
		});

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({
			outcome: "error",
			failureCode: "backend_provision_failed",
		});
		const failure = backends.failures[0]?.failure;
		expect(failure?.failureKind).toBe("provider");
		expect(failure?.failureSource).toBe("supabase_api");
		expect(failure?.failureProviderMessage).toBe("INIT_FAILED");
	});

	it("fails backend_base_schema_missing when the base SQL cannot be read", async () => {
		const { backends, client, deps } = setup(backendRow(), {
			statuses: ["ACTIVE_HEALTHY"],
		});
		deps.readBaseSql.mockRejectedValue(
			new Error("ENOENT: no such file or directory"),
		);

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({
			outcome: "error",
			failureCode: "backend_base_schema_missing",
		});
		expect(backends.failures[0]?.failure.failureKind).toBe("config");
		expect(client.runSql).not.toHaveBeenCalled();
	});

	it("turns email confirmation off without the URL fields when the worker has no preview domain", async () => {
		const { backends, client, deps } = setup(backendRow(), {
			statuses: ["ACTIVE_HEALTHY"],
			previewDomain: null,
		});

		const result = await runProvisionBackend(deps, INPUT);

		expect(result.outcome).toBe("active");
		// The email settings need no preview domain, so they still go out.
		expect(client.authCalls).toEqual([
			{
				scope: { projectId: PROJECT_ID, ref: REF },
				input: { externalEmailEnabled: true, confirmationEmail: null },
			},
		]);
		expect(backends.markActive).toHaveBeenCalledTimes(1);
	});

	it("maps a Management API error onto the failure columns", async () => {
		const { backends, client, deps } = setup(backendRow(), {
			statuses: ["ACTIVE_HEALTHY"],
		});
		client.getApiKeys.mockRejectedValue(
			new SupabaseManagementError(
				"supabase GET /projects/x/api-keys answered 403",
				403,
				"req-1",
				"forbidden",
			),
		);

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({
			outcome: "error",
			failureCode: "backend_provision_failed",
		});
		const failure = backends.failures[0]?.failure;
		expect(failure?.failureKind).toBe("provider");
		expect(failure?.failureSource).toBe("supabase_api");
		expect(failure?.failureProvider).toBe("supabase");
		expect(failure?.failureProviderMessage).toBe("forbidden");
		expect(failure?.failureRequestId).toBe("req-1");
	});

	it("still ends active when the audit insert fails", async () => {
		const { backends, deps, logs } = setup(backendRow(), {
			statuses: ["ACTIVE_HEALTHY"],
		});
		deps.auditEvents.insert.mockRejectedValue(new Error("db down"));

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({ outcome: "active", failureCode: null });
		expect(backends.markError).not.toHaveBeenCalled();
		expect(
			logs.filter(
				(line) =>
					line.level === "error" &&
					line.message === "supabase.provisioning.audit-failed",
			),
		).toHaveLength(1);
	});

	it("writes the backend .env into a running sandbox after markActive", async () => {
		const { deps, sandboxes } = setup(backendRow(), {
			statuses: ["ACTIVE_HEALTHY"],
		});
		const sandbox = await sandboxes.getOrCreate(PROJECT_ID, SANDBOX_OPTIONS);
		// The dev port wait of the write; a fake port answers at once.
		sandboxes.respondTo("bash", { exitCode: 0, stderr: "", stdout: "" });

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({ outcome: "active", failureCode: null });
		const bytes = await sandbox.readFile(`${FAKE_WORKSPACE_DIR}/.env`);
		expect(bytes === null ? null : new TextDecoder().decode(bytes)).toContain(
			`EXPO_PUBLIC_SUPABASE_URL=https://${REF}.supabase.co`,
		);
	});

	it("still ends active when the .env write fails", async () => {
		const { backends, deps, logs, sandboxes } = setup(backendRow(), {
			statuses: ["ACTIVE_HEALTHY"],
		});
		// No scripted dev port answer: the fake exec throws, like a vendor error.
		await sandboxes.getOrCreate(PROJECT_ID, SANDBOX_OPTIONS);

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({ outcome: "active", failureCode: null });
		expect(backends.markError).not.toHaveBeenCalled();
		expect(
			logs.filter(
				(line) =>
					line.level === "warn" &&
					line.message === "supabase.provisioning.env-file-failed",
			),
		).toHaveLength(1);
	});

	it("still ends error when markError itself fails", async () => {
		const { backends, deps, logs } = setup(backendRow(), {
			statuses: ["INIT_FAILED"],
		});
		backends.markError.mockRejectedValue(new Error("db down"));

		const result = await runProvisionBackend(deps, INPUT);

		expect(result).toEqual({
			outcome: "error",
			failureCode: "backend_provision_failed",
		});
		expect(
			logs.some(
				(line) =>
					line.level === "error" &&
					line.message === "supabase.provisioning.mark-error-failed",
			),
		).toBe(true);
	});
});

// A real worker client on the scripted fetch answers the auth config call.
// So the case reads what the runtime stores when Supabase echoes the body.
function scriptAuthConfigAnswers(
	fixture: ReturnType<typeof setup>,
	answers: Response[],
): RecordedRequest[] {
	const requests: RecordedRequest[] = [];
	const realClient = new SupabaseManagementClient({
		fetch: scriptedFetch(answers, requests),
		logger: fixture.deps.logger,
		organizationSlug: "wandit-org",
		ownsRef: async () => true,
		rateLimiter: new FakeSupabaseRateLimiter(),
		sleep: async () => undefined,
		token: "sbp_test_token",
	});
	fixture.client.updateAuthConfig.mockImplementation((scope, input) =>
		realClient.updateAuthConfig(scope, input),
	);
	return requests;
}

// Every text that leaves the run: the failure row, the log lines, and the
// errors that go to Sentry.
function textThatLeavesTheRun(fixture: ReturnType<typeof setup>): string {
	return JSON.stringify({
		captures: fixture.captures.map(({ error }) =>
			error instanceof SupabaseManagementError
				? [error.message, error.detail]
				: String(error),
		),
		failures: fixture.backends.failures,
		logs: fixture.logs,
	});
}

// A Supabase error answer that repeats the SMTP password of the request.
function echoAnswer(status: number): Response {
	return jsonResponse(
		status,
		JSON.stringify({ message: `smtp_pass ${RESEND_KEY} is not valid` }),
	);
}

describe("runProvisionBackend sign-up code email", () => {
	const SENDER_ENV = {
		appAuthEmailFrom: EMAIL_FROM,
		resendPlatformApiKey: RESEND_KEY,
	};

	it("sends the sender when the worker has the two values and the template has the code step", async () => {
		const fixture = setup(backendRow(), {
			...SENDER_ENV,
			// The braces would start a Go template action in the email body.
			project: { ...PROJECT, name: "Nour {{ .SiteURL }} Objets" },
			statuses: ["ACTIVE_HEALTHY"],
		});

		const result = await runProvisionBackend(fixture.deps, INPUT);

		expect(result.outcome).toBe("active");
		expect(fixture.client.authCalls[0]?.input.confirmationEmail).toEqual({
			confirmationHtml: expect.stringContaining("<b>Nour .SiteURL Objets</b>"),
			fromAddress: EMAIL_FROM,
			resendApiKey: RESEND_KEY,
			senderName: "Nour .SiteURL Objets",
		});
		expect(textThatLeavesTheRun(fixture)).not.toContain(RESEND_KEY);
	});

	it.each([
		{
			case: "the worker has only one of the two values",
			options: { appAuthEmailFrom: EMAIL_FROM },
			reason: "RESEND_PLATFORM_API_KEY-unset",
		},
		{
			case: "the template is older than the code step",
			options: {
				...SENDER_ENV,
				project: { ...PROJECT, templateVersion: "web-app@1.1.0" },
			},
			reason: "template-without-code-step",
		},
		{
			case: "the project row is gone",
			options: { ...SENDER_ENV, project: null },
			reason: "project-missing",
		},
	])("gives a session at sign-up and warns when $case", async ({
		options,
		reason,
	}) => {
		const { client, deps, logs } = setup(backendRow(), {
			...options,
			statuses: ["ACTIVE_HEALTHY"],
		});

		const result = await runProvisionBackend(deps, INPUT);

		expect(result.outcome).toBe("active");
		expect(
			client.authCalls.map((call) => call.input.confirmationEmail),
		).toEqual([null]);
		expect(
			logs.filter(
				(line) =>
					line.message === "supabase.provisioning.email-confirmation-off",
			),
		).toEqual([
			{
				fields: { projectId: PROJECT_ID, ref: REF, reason },
				level: "warn",
				message: "supabase.provisioning.email-confirmation-off",
			},
		]);
	});

	it("keeps the backend alive without email when Supabase refuses the sender", async () => {
		const fixture = setup(backendRow(), {
			...SENDER_ENV,
			statuses: ["ACTIVE_HEALTHY"],
		});
		const requests = scriptAuthConfigAnswers(fixture, [
			echoAnswer(400),
			jsonResponse(
				200,
				JSON.stringify({
					external_email_enabled: true,
					site_url: null,
					smtp_host: null,
					smtp_sender_name: null,
					uri_allow_list: null,
				}),
			),
		]);

		const result = await runProvisionBackend(fixture.deps, INPUT);

		expect(result).toEqual({ outcome: "active", failureCode: null });
		expect(fixture.backends.markError).not.toHaveBeenCalled();
		// The second PATCH is the mode without email: no SMTP field goes out.
		const bodies = requests.map((request) => request.body ?? "");
		expect(bodies).toHaveLength(2);
		expect(bodies[0]).toContain(RESEND_KEY);
		expect(bodies[1]).toContain('"mailer_autoconfirm":true');
		expect(bodies[1]).not.toContain("smtp_");
		// An operator learns of the refusal from the log and from Sentry.
		expect(fixture.captures).toHaveLength(1);
		expect(
			fixture.logs.find(
				(line) =>
					line.message === "supabase.provisioning.email-confirmation-refused",
			)?.fields,
		).toEqual({ projectId: PROJECT_ID, ref: REF, status: "400" });
		expect(textThatLeavesTheRun(fixture)).not.toContain(RESEND_KEY);
	});

	// A 5xx and a rate limit are not a refusal of the sender: no fallback.
	it.each([
		500, 429,
	])("fails the run on HTTP %s and keeps the SMTP password out of the failure row, the logs, and Sentry", async (status) => {
		const fixture = setup(backendRow(), {
			...SENDER_ENV,
			statuses: ["ACTIVE_HEALTHY"],
		});
		// The worker client makes 5 attempts.
		const requests = scriptAuthConfigAnswers(
			fixture,
			Array.from({ length: 5 }, () => echoAnswer(status)),
		);

		const result = await runProvisionBackend(fixture.deps, INPUT);

		expect(result).toEqual({
			outcome: "error",
			failureCode: "backend_provision_failed",
		});
		expect(requests).toHaveLength(5);
		expect(fixture.backends.failures[0]?.failure.failureProviderMessage).toBe(
			`Supabase answered the auth config call with HTTP ${status}`,
		);
		expect(textThatLeavesTheRun(fixture)).not.toContain(RESEND_KEY);
	});
});

describe("instanceSizeFromEnv", () => {
	it("parses the env value and falls back to micro", () => {
		const logger: SandboxLogger = {
			error: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
		};

		expect(instanceSizeFromEnv(undefined, logger)).toBe("micro");
		expect(instanceSizeFromEnv("small", logger)).toBe("small");
		expect(instanceSizeFromEnv("huge", logger)).toBe("micro");
		expect(logger.warn).toHaveBeenCalledTimes(1);
		expect(logger.warn).toHaveBeenCalledWith(
			"supabase.provisioning.instance-size-invalid",
			{ value: "huge" },
		);
	});
});
