/**
 * Fakes for the specs of the agent backend tools (WANDIT-186). It builds
 * one `BackendToolDeps` with a real interactive `SupabaseManagementClient`
 * on the scripted fetch, in-memory secret and audit sinks, and a context on
 * a `FakeSandboxProvider` handle. The specs in this folder and
 * `advisors.service.spec.ts` use it.
 */
import type { ProjectSecretKind } from "@wandit/contracts";
import type { Tool } from "ai";
import { z } from "zod";

import type { HostToolContext } from "../../../domain/ports/host-tools";
import type { AppBackendRow } from "../../../infrastructure/persistence/app-backends.repository";
import type { AuditEventInput } from "../../../infrastructure/persistence/audit-events.repository";
import { FakeSandboxProvider } from "../../../infrastructure/sandbox/fake-sandbox.provider";
import {
	type RecordedRequest,
	scriptedFetch,
} from "../../../infrastructure/supabase/fake-supabase-fetch";
import { FakeSupabaseRateLimiter } from "../../../infrastructure/supabase/fake-supabase-rate-limiter";
import { SupabaseManagementClient } from "../../../infrastructure/supabase/supabase-management.client";
import type { SecretActor } from "../../services/project-secrets.service";
import type { BackendToolDeps } from "./backend-tool-deps";

/** The ref of the fake backend: 20 lower-case letters, like a real ref. */
export const FAKE_REF = "abcdefghijklmnopqrst";

/** The fixed clock of the fixture; the migration stamp is `20260923101500`. */
export const FAKE_NOW = new Date("2026-09-23T10:15:00.000Z");

/** An `active` backend row of `project-1`; specs spread it to change the status. */
export const ACTIVE_BACKEND_ROW: AppBackendRow = {
	anonKey: "anon-key",
	dbHost: `db.${FAKE_REF}.supabase.co`,
	failureCode: null,
	id: "backend-1",
	orgId: "org_123",
	organizationId: "org-1",
	projectId: "project-1",
	ref: FAKE_REF,
	region: "eu-central-1",
	requestKey: "request-1",
	status: "active",
	triggerRunId: "run_1",
	userId: "user-1",
};

/** One logger call the fixture recorded. */
export type RecordedLogLine = {
	message: string;
	/** The structured fields of the line, for example the tool and the ref. */
	fields: Record<string, string | number | null>;
};

/** One `secrets.set` call the fixture recorded. */
export type RecordedSecretSet = {
	name: string;
	value: string;
	kind: ProjectSecretKind;
	/** The scope `ProjectSecretsService.set` checks the project against. */
	actor: SecretActor;
};

/** One `secretsRepo.markSynced` call the fixture recorded. */
export type RecordedSync = {
	projectId: string;
	name: string;
	at: Date;
};

type BackendToolFixtureOptions = {
	/** Scripted Management API answers, in call order. */
	answers?: (Response | Error)[];
	/** The `app_backends` row; null means the project has none. Default: active. */
	backend?: AppBackendRow | null;
	/** False composes no client, like a worker without `SUPABASE_PLATFORM_TOKEN`. */
	withClient?: boolean;
	/** Scripted limiter waits in ms; a positive wait fails the call as rate limited. */
	rateLimiterWaits?: number[];
	/** Stored secret values by name. */
	storedSecrets?: Map<string, string>;
};

/** Builds the deps, the context, and the recorders of one spec case. */
export async function createBackendToolFixture(
	options: BackendToolFixtureOptions = {},
) {
	const requests: RecordedRequest[] = [];
	const audits: AuditEventInput[] = [];
	const infos: RecordedLogLine[] = [];
	const warnings: RecordedLogLine[] = [];
	const secretSets: RecordedSecretSet[] = [];
	const syncs: RecordedSync[] = [];
	/** Project ids `backends.touchActive` got, in call order. */
	const touches: string[] = [];
	const stored = new Map(options.storedSecrets);
	const backend =
		options.backend === undefined ? ACTIVE_BACKEND_ROW : options.backend;

	const client =
		options.withClient === false
			? null
			: new SupabaseManagementClient({
					fetch: scriptedFetch(options.answers ?? [], requests),
					// The task composes the interactive form: a full bucket answers at once.
					interactive: true,
					logger: {
						error: () => undefined,
						info: () => undefined,
						warn: () => undefined,
					},
					organizationSlug: "wandit-org",
					ownsRef: async () => true,
					rateLimiter: new FakeSupabaseRateLimiter(options.rateLimiterWaits),
					sleep: async () => undefined,
					token: "sbp_test_token",
				});

	const provider = new FakeSandboxProvider();
	const sandbox = await provider.getOrCreate("project-1", {
		devCommand: "pnpm run dev",
		devPort: 5173,
		env: {},
		framework: "web-app",
		organizationId: "org-1",
		ownerUserId: "user-1",
		templateVersion: "web-app@1.0.0",
	});
	const context: HostToolContext = {
		actorUserId: "user-1",
		chatId: "chat-1",
		holdEventId: null,
		organizationId: "org-1",
		projectId: "project-1",
		sandbox,
		subject: { actorUserId: "user-1", organizationId: "org-1" },
		turnId: "turn-1",
	};

	const deps: BackendToolDeps = {
		audit: {
			insert: async (row) => {
				audits.push(row);
			},
		},
		backends: {
			findByProjectId: async () => backend,
			touchActive: async (projectId) => {
				touches.push(projectId);
			},
		},
		client,
		logger: {
			info: (message: string, fields: RecordedLogLine["fields"]) => {
				infos.push({ fields, message });
			},
			warn: (message: string, fields: RecordedLogLine["fields"]) => {
				warnings.push({ fields, message });
			},
		},
		now: () => FAKE_NOW,
		secrets: {
			readValue: async (_projectId, name) => stored.get(name) ?? null,
			set: async (_projectId, name, value, kind, actor) => {
				secretSets.push({ actor, kind, name, value });
				stored.set(name, value);
			},
		},
		secretsRepo: {
			markSynced: async (projectId, name, at) => {
				syncs.push({ at, name, projectId });
			},
		},
	};

	return {
		audits,
		context,
		deps,
		infos,
		provider,
		requests,
		sandbox,
		secretSets,
		syncs,
		touches,
		warnings,
	};
}

/**
 * Runs `execute` of one tool with a fixed call id and answers its output.
 * Throws when the tool has no `execute` or answers a stream.
 */
export async function executeTool<
	TInput extends Record<string, unknown>,
	TOutput extends { status: string },
>(
	tool: Tool<TInput, TOutput>,
	// `NoInfer`: the tool fixes the input type, not the literal of the spec.
	input: NoInfer<TInput>,
): Promise<TOutput> {
	const execute = tool.execute;
	if (execute === undefined) {
		throw new Error("a backend tool must define execute");
	}
	const output = await execute(input, {
		context: {},
		messages: [],
		toolCallId: "tc-1",
	});
	// The AI SDK type allows a stream; the backend tools answer one value.
	if (Symbol.asyncIterator in output) {
		throw new Error("a backend tool must answer one value, not a stream");
	}
	return output;
}

// The body of one `database/query` call; `runSql` sends no `read_only`.
const sentQuerySchema = z.object({
	query: z.string(),
	read_only: z.boolean().optional(),
});

/** The parsed body of one recorded SQL request. Throws for another request. */
export function sentQuery(
	request: RecordedRequest | undefined,
): z.infer<typeof sentQuerySchema> {
	return sentQuerySchema.parse(JSON.parse(request?.body ?? "null"));
}
