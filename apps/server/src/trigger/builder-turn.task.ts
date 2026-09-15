/**
 * `builder-turn` Trigger.dev task (WANDIT-166): one builder turn per run.
 * `trigger-turn-task-starter.ts` queues it by task id and `turn-promotion`
 * requeues it; the run body lives in `builder-turn.runtime.ts` so the spec
 * drives it with fakes. The task file only wires real dependencies.
 */
import "./undici-timeouts";

import { logger, schemaTask } from "@trigger.dev/sdk";
import { appBuilderRoutes } from "@wandit/contracts";
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { z } from "zod";

import { contentTypeFor, putSiteFile } from "../infrastructure/storage/r2";
import { createBuilderHarness } from "../modules/app-builder/application/harness/builder-harness.factory";
import { BuilderHostToolRegistry } from "../modules/app-builder/application/host-tools/builder-host-tool-registry";
import { mintLlmProxyToken } from "../modules/app-builder/application/services/llm-proxy-token.service";
import { TurnPromoter } from "../modules/app-builder/application/services/turn-promotion";
import { CodeStorageGitStore } from "../modules/app-builder/infrastructure/git/code-storage.git-store";
import { CodeStorageRepoRestorer } from "../modules/app-builder/infrastructure/git/code-storage-repo-restorer";
import { commitTurn } from "../modules/app-builder/infrastructure/git/commit-turn";
import { AppCommitsRepository } from "../modules/app-builder/infrastructure/persistence/app-commits.repository";
import { BuilderSessionsRepository } from "../modules/app-builder/infrastructure/persistence/builder-sessions.repository";
import { BuilderTurnsRepository } from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import { ProjectCostCapsRepository } from "../modules/app-builder/infrastructure/persistence/project-cost-caps.repository";
import { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import { TurnProjectRepository } from "../modules/app-builder/infrastructure/persistence/turn-project.repository";
import { LlmSpendCounters } from "../modules/app-builder/infrastructure/redis/llm-spend-counters";
import { RedisTurnLock } from "../modules/app-builder/infrastructure/redis/redis-turn-lock";
import {
	ArchiveTemplateInit,
	TEMPLATE_ARCHIVE_DIR,
} from "../modules/app-builder/infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/vercel-sandbox.provider";
import { TriggerTurnEventWriter } from "../modules/app-builder/infrastructure/trigger/trigger-turn-events";
import { TriggerTurnTaskStarter } from "../modules/app-builder/infrastructure/trigger/trigger-turn-task-starter";
import { SubscriptionsRepository } from "../modules/billing/infrastructure/persistence/subscriptions.repository";
import { subjectPayer } from "../modules/credits/domain/credit-owner";
import { ChatsRepository } from "../modules/generation/infrastructure/persistence/chats.repository";

import { builderTurnQueue } from "./builder-task-queues";
import {
	builderTurnCancelFinalizer,
	runBuilderTurn,
} from "./builder-turn.runtime";
import { createTriggerMetering } from "./metering.runtime";

// Half the SDK's ~30 s kill window; leaves time for the finalizer itself.
const CANCEL_RUN_SETTLE_GRACE_MS = 15_000;

/** One builder turn: sandbox, harness session, stream, commit, settle. */
export const builderTurnTask = schemaTask({
	id: "builder-turn",
	// One turn fits in the small-2x profile: the agent process runs inside
	// the sandbox, so the worker only holds the stream and the DB pool.
	machine: "small-2x",
	// 60 minutes: the proxy token TTL assumes the same ceiling.
	maxDuration: 3600,
	queue: builderTurnQueue,
	// A retried run must not start a second turn: the row CAS and the task
	// idempotency key already dedupe, so one attempt is the whole contract.
	retry: { maxAttempts: 1 },
	schema: z.object({
		actorIsLimitExempt: z.boolean().optional(),
		actorUserId: z.string().min(1),
		organizationId: z.string().min(1).nullable(),
		projectId: z.uuid(),
		turnId: z.uuid(),
	}),
	// onCancel is declared below `run` on purpose: the hook's payload type
	// is inferred from run's annotation, resolved in source order.
	run: async (payload, { ctx, signal }) => {
		// Fresh pool per run; ended in `finally` so the worker process can
		// be reused without leaking Postgres connections.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		const writer = new TriggerTurnEventWriter();
		const turnLock = new RedisTurnLock();
		const counters = new LlmSpendCounters();
		try {
			const turns = new BuilderTurnsRepository(db);
			const sandboxSessions = new SandboxSessionsRepository(db);
			const gitStore = new CodeStorageGitStore(env);
			const sandboxes = new VercelSandboxProvider(
				sandboxSessions,
				new CodeStorageRepoRestorer(gitStore, new AppCommitsRepository(db)),
				new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
			);
			const chats = new ChatsRepository(db);
			const subscriptions = new SubscriptionsRepository(db);
			const metering = createTriggerMetering(db);
			const promoter = new TurnPromoter(
				turns,
				turnLock,
				new TriggerTurnTaskStarter(),
			);

			await runBuilderTurn(
				{
					caps: new ProjectCostCapsRepository(db),
					commit: commitTurn,
					commitDeps: {
						appCommits: new AppCommitsRepository(db),
						gitStore,
						putPatch: (key, text) =>
							putSiteFile(key, text, contentTypeFor(key)),
					},
					counters,
					harness: createBuilderHarness(env.V2_HARNESS),
					hostTools: new BuilderHostToolRegistry({
						imageEditModel: env.AI_IMAGE_EDIT_MODEL ?? null,
						imageModel: env.AI_IMAGE_MODEL ?? null,
						logger,
						metering,
					}),
					insertAssistantMessage: (input) =>
						chats.insertTurnAssistantMessage(input),
					lock: turnLock,
					logger,
					metering,
					mintToken: (claims) => mintLlmProxyToken(claims, env),
					model: env.V2_DEFAULT_MODEL ?? null,
					now: Date.now,
					project: new TurnProjectRepository(db),
					promoteNext: async (projectId, endedTurnId) => {
						// The row answer is TurnPromoter's own bookkeeping; the
						// runtime only needs the promotion attempted.
						await promoter.promoteNext(projectId, endedTurnId);
					},
					// The sandbox runs in the vendor cloud, so the proxy needs a
					// public URL. Local dev sets a tunnel; deployed APIs are public.
					proxyBaseUrl: new URL(
						appBuilderRoutes.llmProxyBase,
						env.V2_LLM_PROXY_PUBLIC_URL ?? env.BETTER_AUTH_URL,
					).toString(),
					resolvePlan: async (subject) => {
						const row = await subscriptions.findActiveByOwner(
							subjectPayer(subject),
						);
						// The billing_plan enum has no free value; starter is the
						// free tier (llm-proxy.ts).
						return row?.plan ?? "starter";
					},
					sandboxSessions,
					sandboxes,
					sessions: new BuilderSessionsRepository(db),
					turns,
					// The service already converts AI_USD_PER_CREDIT at build.
					usdMicrosPerCredit: metering.usdMicrosPerCredit,
					writer,
				},
				{
					actorUserId: payload.actorUserId,
					...(payload.actorIsLimitExempt === undefined
						? {}
						: { actorIsLimitExempt: payload.actorIsLimitExempt }),
					organizationId: payload.organizationId,
					projectId: payload.projectId,
					runId: ctx.run.id,
					turnId: payload.turnId,
				},
				signal,
			);
		} finally {
			// After the last `done` event, before the pool ends.
			await writer.close();
			// Both hold a Redis client; close them next to the pool (A6).
			await counters.onModuleDestroy();
			await turnLock.onModuleDestroy();
			await db.$client.end();
		}
	},
	onCancel: async ({ ctx, runPromise }) => {
		// The aborted signal usually lets the run's own catch do the full
		// cancel cleanup. Wait for that first; the timer guards the run
		// stuck in an await the abort signal cannot reach.
		await Promise.race([
			runPromise.then(
				() => undefined,
				() => undefined,
			),
			new Promise((resolve) =>
				setTimeout(resolve, CANCEL_RUN_SETTLE_GRACE_MS).unref(),
			),
		]);

		// Present only while the run still unwinds — its finally removes
		// the entry. The finalizer is memoized, so a double call is safe.
		const finalize = builderTurnCancelFinalizer(ctx.run.id);
		if (finalize) {
			await finalize();
		}
	},
});
