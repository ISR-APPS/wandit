import { describe, expect, it } from "vitest";

import type {
	LlmProxyRequestsRepository,
	LlmProxyTurnSum,
} from "../modules/app-builder/infrastructure/persistence/llm-proxy-requests.repository";
import type { MeteringService } from "../modules/metering/application/services/metering.service";
import type { AiUsageEvent } from "../modules/metering/domain/metering";
import {
	RECONCILE_BATCH_LIMIT,
	RECONCILE_MAX_AGE_MS,
	RECONCILE_MIN_AGE_MS,
	runReconcileAgentSessions,
} from "./reconcile-agent-sessions.runtime";

const NOW = new Date("2030-06-01T12:00:00Z");

function makeLogger() {
	const lines: {
		fields: Record<string, string>;
		level: string;
		message: string;
	}[] = [];
	return {
		lines,
		logger: {
			error(message: string, fields: Record<string, string>) {
				lines.push({ fields, level: "error", message });
			},
			info(message: string, fields: Record<string, string>) {
				lines.push({ fields, level: "info", message });
			},
			warn(message: string, fields: Record<string, string>) {
				lines.push({ fields, level: "warn", message });
			},
		},
	};
}

function makeSettledAgentEvent(
	id: string,
	attemptRef: string | null,
): AiUsageEvent {
	return {
		attemptRef,
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: null,
		createdAt: new Date("2030-06-01T10:00:00Z"),
		estimatedCostUsdMicros: null,
		executionLeaseExpiresAt: null,
		executionLeaseToken: null,
		finalCredits: 1_000,
		id,
		idempotencyKey: `reserve:${id}`,
		inputTokens: null,
		messageId: null,
		model: "anthropic/claude-sonnet-5",
		nextReconcileAttemptAt: null,
		operation: "agent_session",
		organizationId: null,
		outputTokens: null,
		parentEventId: null,
		pricingSnapshot: null,
		projectId: "project-1",
		provider: "llm_proxy",
		rawUsage: null,
		reconcileAttempts: 0,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: 1_000,
		settledAt: new Date("2030-06-01T11:00:00Z"),
		status: "settled",
		userId: "user-1",
	};
}

function makeTurnSum(usdMicros: number): LlmProxyTurnSum {
	return {
		byModel: [
			{
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				inputTokens: 1_000,
				model: "anthropic/claude-sonnet-5",
				outputTokens: 100,
				usdMicros,
			},
		],
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		inputTokens: 1_000,
		outputTokens: 100,
		usdMicros,
	};
}

function makeEmptyTurnSum(): LlmProxyTurnSum {
	return {
		byModel: [],
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		inputTokens: 0,
		outputTokens: 0,
		usdMicros: 0,
	};
}

function makeMetering(
	events: AiUsageEvent[],
	deltaByEventId: ReadonlyMap<string, number>,
) {
	const listCalls: {
		limit: number;
		olderThan: Date;
		youngerThan: Date;
	}[] = [];
	const reconcileCalls: Parameters<MeteringService["reconcileAgentSession"]>[] =
		[];
	const metering: Pick<
		MeteringService,
		"listSettledAgentSessions" | "reconcileAgentSession"
	> = {
		listSettledAgentSessions: (olderThan, youngerThan, limit) => {
			listCalls.push({ limit, olderThan, youngerThan });
			return Promise.resolve(events);
		},
		reconcileAgentSession: (eventId, input) => {
			reconcileCalls.push([eventId, input]);
			// A spec lists the events it seeds; an unknown id is a spec bug.
			const event = events.find((candidate) => candidate.id === eventId);
			if (event === undefined) {
				return Promise.reject(new Error(`Unknown event ${eventId}`));
			}
			return Promise.resolve({
				deltaCredits: deltaByEventId.get(eventId) ?? 0,
				event,
			});
		},
	};
	return { listCalls, metering, reconcileCalls };
}

function makeProxyRows(sumForTurn: (turnId: string) => LlmProxyTurnSum) {
	const calls: string[] = [];
	const proxyRows: Pick<LlmProxyRequestsRepository, "sumByTurn"> = {
		sumByTurn: (turnId) => {
			calls.push(turnId);
			return Promise.resolve(sumForTurn(turnId));
		},
	};
	return { calls, proxyRows };
}

describe("runReconcileAgentSessions", () => {
	it("reprices an event whose proxy rows cost ten percent more", async () => {
		const event = makeSettledAgentEvent("evt-1", "turn-1");
		const rows = makeTurnSum(1_100_000);
		const { metering, reconcileCalls } = makeMetering(
			[event],
			new Map([["evt-1", 110]]),
		);
		const { proxyRows } = makeProxyRows(() => rows);
		const { lines, logger } = makeLogger();

		const result = await runReconcileAgentSessions({
			logger,
			metering,
			now: () => NOW,
			proxyRows,
		});

		expect(result).toEqual({
			corrected: 1,
			failed: 0,
			scanned: 1,
			skipped: 0,
			unchanged: 0,
		});
		expect(reconcileCalls).toEqual([
			["evt-1", { costUsdMicros: rows.usdMicros, rawUsage: rows.byModel }],
		]);
		expect(lines).toEqual([
			{
				fields: {
					deltaCredits: "110",
					eventId: "evt-1",
					turnId: "turn-1",
				},
				level: "info",
				message: "reconcile.agent-session",
			},
		]);
	});

	it("still reconciles an event whose rows match the settled charge", async () => {
		const event = makeSettledAgentEvent("evt-1", "turn-1");
		const { metering, reconcileCalls } = makeMetering([event], new Map());
		const { proxyRows } = makeProxyRows(() => makeTurnSum(1_000_000));
		const { logger } = makeLogger();

		const result = await runReconcileAgentSessions({
			logger,
			metering,
			now: () => NOW,
			proxyRows,
		});

		expect(result).toEqual({
			corrected: 0,
			failed: 0,
			scanned: 1,
			skipped: 0,
			unchanged: 1,
		});
		// A zero delta still visits the service: it marks the event reconciled.
		expect(reconcileCalls).toHaveLength(1);
	});

	it("counts one bad event as failed and still processes the rest", async () => {
		const events = [
			makeSettledAgentEvent("evt-1", "turn-1"),
			makeSettledAgentEvent("evt-2", "turn-bad"),
			makeSettledAgentEvent("evt-3", "turn-3"),
		];
		const { metering, reconcileCalls } = makeMetering(events, new Map());
		const { proxyRows } = makeProxyRows((turnId) => {
			if (turnId === "turn-bad") {
				throw new Error("proxy read failed");
			}
			return makeTurnSum(500_000);
		});
		const { lines, logger } = makeLogger();

		const result = await runReconcileAgentSessions({
			logger,
			metering,
			now: () => NOW,
			proxyRows,
		});

		expect(result).toEqual({
			corrected: 0,
			failed: 1,
			scanned: 3,
			skipped: 0,
			unchanged: 2,
		});
		expect(reconcileCalls.map(([eventId]) => eventId)).toEqual([
			"evt-1",
			"evt-3",
		]);
		expect(lines).toContainEqual({
			fields: {
				error: "proxy read failed",
				eventId: "evt-2",
				turnId: "turn-bad",
			},
			level: "error",
			message: "reconcile.agent-session.failed",
		});
	});

	it("counts an event with no attemptRef as failed without reconciling", async () => {
		const event = makeSettledAgentEvent("evt-null", null);
		const { metering, reconcileCalls } = makeMetering([event], new Map());
		const { calls, proxyRows } = makeProxyRows(() => makeTurnSum(0));
		const { lines, logger } = makeLogger();

		const result = await runReconcileAgentSessions({
			logger,
			metering,
			now: () => NOW,
			proxyRows,
		});

		expect(result).toEqual({
			corrected: 0,
			failed: 1,
			scanned: 1,
			skipped: 0,
			unchanged: 0,
		});
		expect(calls).toEqual([]);
		expect(reconcileCalls).toEqual([]);
		expect(lines).toEqual([
			{
				fields: { eventId: "evt-null" },
				level: "warn",
				message: "reconcile.agent-session.no-attempt-ref",
			},
		]);
	});

	it("skips an event whose turn has no proxy rows", async () => {
		const event = makeSettledAgentEvent("evt-1", "turn-gone");
		const { metering, reconcileCalls } = makeMetering([event], new Map());
		const { proxyRows } = makeProxyRows(() => makeEmptyTurnSum());
		const { lines, logger } = makeLogger();

		const result = await runReconcileAgentSessions({
			logger,
			metering,
			now: () => NOW,
			proxyRows,
		});

		expect(result).toEqual({
			corrected: 0,
			failed: 0,
			scanned: 1,
			skipped: 1,
			unchanged: 0,
		});
		expect(reconcileCalls).toEqual([]);
		expect(lines).toEqual([
			{
				fields: { eventId: "evt-1", turnId: "turn-gone" },
				level: "warn",
				message: "reconcile.agent-session.no-rows",
			},
		]);
	});

	it("lists settled events inside the age window with the batch limit", async () => {
		const { listCalls, metering } = makeMetering([], new Map());
		const { proxyRows } = makeProxyRows(() => makeTurnSum(0));
		const { logger } = makeLogger();

		await runReconcileAgentSessions({
			logger,
			metering,
			now: () => NOW,
			proxyRows,
		});

		expect(listCalls).toEqual([
			{
				limit: RECONCILE_BATCH_LIMIT,
				olderThan: new Date(NOW.getTime() - RECONCILE_MIN_AGE_MS),
				youngerThan: new Date(NOW.getTime() - RECONCILE_MAX_AGE_MS),
			},
		]);
		expect(RECONCILE_BATCH_LIMIT).toBe(200);
		expect(RECONCILE_MIN_AGE_MS).toBe(600_000);
		expect(RECONCILE_MAX_AGE_MS).toBe(172_800_000);
	});
});
