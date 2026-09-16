/**
 * Reconcile-sweep runtime: reprices settled `agent_session` events against
 * the `llm_proxy_requests` rows, the billing source of truth.
 * `reconcile-agent-sessions.task.ts` calls it through
 * `createReconcileAgentSessionsRuntime` every 15 minutes; the spec calls
 * `runReconcileAgentSessions` with fakes. No Nest here — Trigger workers
 * compose dependencies by hand.
 */
import type { createDb } from "@wandit/db";
import { Sentry } from "@wandit/observability/node";

import type { SandboxLogger } from "../modules/app-builder/domain/ports/sandbox-provider";
import { LlmProxyRequestsRepository } from "../modules/app-builder/infrastructure/persistence/llm-proxy-requests.repository";
import type { MeteringService } from "../modules/metering/application/services/metering.service";

import { createTriggerMetering } from "./metering.runtime";

type TriggerDatabase = ReturnType<typeof createDb>;

/**
 * The proxy rows land synchronously, but a settle and the last proxy row
 * can straddle the sweep; 10 minutes is far past any in-flight request.
 */
export const RECONCILE_MIN_AGE_MS = 10 * 60_000;

/**
 * Two days covers a sweep outage over a weekend; older events stay
 * `settled` and admin review owns them.
 */
export const RECONCILE_MAX_AGE_MS = 48 * 60 * 60_000;

/** About 200 events × 2 queries fits the 240 s task budget. */
export const RECONCILE_BATCH_LIMIT = 200;

/** The slice of the sweep the spec fakes. */
export type ReconcileAgentSessionsDeps = {
	/** Settled-event page read plus the per-event reprice. */
	metering: Pick<
		MeteringService,
		"listSettledAgentSessions" | "reconcileAgentSession"
	>;
	/** `llm_proxy_requests` sums: the turn's real spend, grouped by model. */
	proxyRows: Pick<LlmProxyRequestsRepository, "sumByTurn">;
	/** `Sentry.logger` in production; every field value is a string. */
	logger: SandboxLogger;
	/** Clock injection for specs; production reads `new Date()`. */
	now?: () => Date;
};

/**
 * Reprices one page of settled `agent_session` events, oldest first.
 * `attemptRef` is the turn id (the reserve sets `attemptRef = turnId`). A
 * non-zero delta counts as `corrected`; the service marks every visited
 * event `reconciled`, so a zero delta is progress too. An event whose turn
 * has no proxy rows counts as `skipped` and keeps its settled charge.
 */
export async function runReconcileAgentSessions(
	deps: ReconcileAgentSessionsDeps,
): Promise<{
	corrected: number;
	failed: number;
	scanned: number;
	skipped: number;
	unchanged: number;
}> {
	const now = deps.now?.() ?? new Date();
	const events = await deps.metering.listSettledAgentSessions(
		new Date(now.getTime() - RECONCILE_MIN_AGE_MS),
		new Date(now.getTime() - RECONCILE_MAX_AGE_MS),
		RECONCILE_BATCH_LIMIT,
	);
	let corrected = 0;
	let failed = 0;
	let skipped = 0;
	let unchanged = 0;
	for (const event of events) {
		const turnId = event.attemptRef;
		if (turnId === null) {
			// A null ref leaves no turn to sum, so this sweep cannot reprice
			// the event; it stays settled for admin review.
			deps.logger.warn("reconcile.agent-session.no-attempt-ref", {
				eventId: event.id,
			});
			failed += 1;
			continue;
		}
		try {
			const rows = await deps.proxyRows.sumByTurn(turnId);
			if (rows.byModel.length === 0) {
				// No `ok` proxy row, for example a deleted turn. A reprice to
				// zero would refund a turn that ran.
				// LIMIT: a skipped event stays settled and is re-read every 15 minutes for 48 hours. Upgrade: mark it reconcile_failed for admin review.
				deps.logger.warn("reconcile.agent-session.no-rows", {
					eventId: event.id,
					turnId,
				});
				skipped += 1;
				continue;
			}
			const { deltaCredits } = await deps.metering.reconcileAgentSession(
				event.id,
				{ costUsdMicros: rows.usdMicros, rawUsage: rows.byModel },
			);
			deps.logger.info("reconcile.agent-session", {
				deltaCredits: String(deltaCredits),
				eventId: event.id,
				turnId,
			});
			if (deltaCredits === 0) {
				unchanged += 1;
			} else {
				corrected += 1;
			}
		} catch (error) {
			// One bad event must not stop the batch.
			const message = error instanceof Error ? error.message : String(error);
			deps.logger.error("reconcile.agent-session.failed", {
				error: message,
				eventId: event.id,
				turnId,
			});
			failed += 1;
		}
	}
	return { corrected, failed, scanned: events.length, skipped, unchanged };
}

/**
 * Composes the real metering service and proxy-rows repository for the
 * Trigger worker. The sweep reads `llm_proxy_requests` through the same
 * repository the settle path uses.
 */
export function createReconcileAgentSessionsRuntime(db: TriggerDatabase) {
	return {
		run: () =>
			runReconcileAgentSessions({
				logger: Sentry.logger,
				metering: createTriggerMetering(db),
				proxyRows: new LlmProxyRequestsRepository(db),
			}),
	};
}
