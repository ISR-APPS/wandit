import type {
	SupabaseInstanceSize,
	SupabaseProjectStatus,
	SupabaseRegion,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { SandboxLogger } from "../modules/app-builder/domain/ports/sandbox-provider";
import type {
	AppBackendFailure,
	AppBackendRow,
} from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import type { AuditEventInput } from "../modules/app-builder/infrastructure/persistence/audit-events.repository";
import type { BackendRef } from "../modules/app-builder/infrastructure/supabase/supabase-management.client";
import { SupabaseManagementError } from "../modules/app-builder/infrastructure/supabase/supabase-management.client";
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
const BASE_SQL = "create extension if not exists pg_cron;";
const PREVIEW_DOMAIN = "preview.test";

const INPUT = { projectId: PROJECT_ID, requestKey: REQUEST_KEY };

type CreateProjectCall = {
	projectId: string;
	region: SupabaseRegion;
	dbPassword: string;
	instanceSize: SupabaseInstanceSize;
};

type AuthConfigCall = {
	scope: BackendRef;
	input: {
		siteUrl: string;
		uriAllowList: string[];
		externalEmailEnabled: boolean;
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

// In-memory `app_backends` repository: one row per project id, and every
// markError input recorded for assertions.
function createBackendsFake(row: AppBackendRow | null) {
	const rows = new Map<string, AppBackendRow>();
	if (row) {
		rows.set(row.projectId, row);
	}
	const failures: { projectId: string; failure: AppBackendFailure }[] = [];
	return {
		failures,
		findByProjectId: vi.fn(
			async (projectId: string) => rows.get(projectId) ?? null,
		),
		markCreated: vi.fn(
			async (projectId: string, input: { ref: string; orgId: string }) => {
				const stored = rows.get(projectId);
				if (stored) {
					stored.ref = input.ref;
					stored.orgId = input.orgId;
				}
			},
		),
		markActive: vi.fn(
			async (
				projectId: string,
				input: { anonKey: string; dbHost: string; lastActiveAt: Date },
			) => {
				const stored = rows.get(projectId);
				if (stored) {
					stored.status = "active";
					stored.anonKey = input.anonKey;
					stored.dbHost = input.dbHost;
				}
			},
		),
		markError: vi.fn(async (projectId: string, failure: AppBackendFailure) => {
			const stored = rows.get(projectId);
			if (stored) {
				stored.status = "error";
				stored.failureCode = failure.failureCode;
			}
			failures.push({ projectId, failure });
		}),
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
	const deps = {
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
		readBaseSql: vi.fn(async () => BASE_SQL),
		sleep: async (ms: number) => {
			sleeps.push(ms);
			fakeNow += ms;
		},
	} satisfies ProvisionBackendDeps;

	return { audits, backends, captures, client, deps, logs, sleeps };
}

describe("runProvisionBackend", () => {
	it("creates the project, polls to healthy, and marks the row active", async () => {
		const { audits, backends, client, deps, logs, sleeps } = setup(
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
		expect(backends.markCreated).toHaveBeenCalledWith(PROJECT_ID, {
			ref: REF,
			orgId: ORG_ID,
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
					uriAllowList: [`https://r-*--p-${PROJECT_ID}.${PREVIEW_DOMAIN}/**`],
					externalEmailEnabled: true,
				},
			},
		]);
		expect(backends.markActive).toHaveBeenCalledWith(PROJECT_ID, {
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
		// No log line may carry the password or the anon key.
		const logged = logs
			.map((line) => `${line.message} ${JSON.stringify(line.fields)}`)
			.join("\n");
		expect(logged).not.toContain(dbPassword);
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

	it("skips the create call when the row already carries a ref", async () => {
		const { client, deps } = setup(backendRow({ ref: REF, orgId: ORG_ID }), {
			statuses: ["ACTIVE_HEALTHY"],
		});

		const result = await runProvisionBackend(deps, INPUT);

		expect(result.outcome).toBe("active");
		expect(client.createProject).not.toHaveBeenCalled();
		expect(client.getCalls).toEqual([{ projectId: PROJECT_ID, ref: REF }]);
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

	it("skips the auth config when the worker has no preview domain", async () => {
		const { backends, client, deps, logs } = setup(backendRow(), {
			statuses: ["ACTIVE_HEALTHY"],
			previewDomain: null,
		});

		const result = await runProvisionBackend(deps, INPUT);

		expect(result.outcome).toBe("active");
		expect(client.updateAuthConfig).not.toHaveBeenCalled();
		expect(
			logs.some(
				(line) =>
					line.level === "warn" &&
					line.message === "supabase.provisioning.auth-config-skipped",
			),
		).toBe(true);
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
