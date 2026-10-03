/**
 * `builder-turn` Trigger.dev task (WANDIT-166): one builder turn per run.
 * `trigger-turn-task-starter.ts` queues it by task id and `turn-promotion`
 * requeues it; the run body lives in `builder-turn.runtime.ts` so the spec
 * drives it with fakes. `builder-turn.deps.ts` wires the real dependencies;
 * the run imports it and the runtime lazily, so the task module loads fast.
 */
import "./undici-timeouts";

import { logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

import { TriggerTurnEventWriter } from "../modules/app-builder/infrastructure/trigger/trigger-turn-events";

import { builderTurnQueue } from "./builder-task-queues";

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
		// Absent on a run queued before the field existed.
		apiCreateMs: z.int().nonnegative().nullable().optional(),
		organizationId: z.string().min(1).nullable(),
		projectId: z.uuid(),
		turnId: z.uuid(),
	}),
	// onCancel is declared below `run` on purpose: the hook's payload type
	// is inferred from run's annotation, resolved in source order.
	run: async (payload, { ctx, signal }) => {
		const writer = new TriggerTurnEventWriter();
		const [{ createBuilderTurnDeps }, { runBuilderTurn }] = await Promise.all([
			import("./builder-turn.deps"),
			import("./builder-turn.runtime"),
		]);
		const resources = await createBuilderTurnDeps(logger);
		try {
			await runBuilderTurn(
				{ ...resources.deps, writer },
				{
					actorUserId: payload.actorUserId,
					apiCreateMs: payload.apiCreateMs ?? null,
					...(payload.actorIsLimitExempt === undefined
						? {}
						: { actorIsLimitExempt: payload.actorIsLimitExempt }),
					organizationId: payload.organizationId,
					projectId: payload.projectId,
					runId: ctx.run.id,
					runner: "trigger",
					turnId: payload.turnId,
				},
				signal,
			);
		} finally {
			// After the last `done` event, before the pool ends.
			await writer.close();
			await resources.close();
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
		const { builderTurnCancelFinalizer } = await import(
			"./builder-turn.runtime"
		);
		const finalize = builderTurnCancelFinalizer(ctx.run.id);
		if (finalize) {
			await finalize();
		}
	},
});
