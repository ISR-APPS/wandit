import { describe, expect, it, vi } from "vitest";

import type {
	TurnRunHandle,
	TurnTaskStarter,
	TurnTaskStartInput,
} from "../../domain/ports/turn-task-starter";
import type { BuilderTurnRunner } from "../persistence/builder-turns.repository";
import {
	type HarnessHostCalls,
	HarnessHostClient,
} from "./harness-host.client";
import {
	createTurnTaskStarter,
	RoutingTurnTaskStarter,
} from "./routing-turn-task-starter";

const INPUT: TurnTaskStartInput = {
	actorUserId: "user-1",
	apiCreateMs: 40,
	organizationId: null,
	projectId: "11111111-1111-4111-8111-111111111111",
	turnId: "22222222-2222-4222-8222-222222222222",
};

/** A row with a `runner` column and the CAS of `assignRunner`. */
function fakeRow(claimedByHost = false) {
	const row = { runner: "trigger" as BuilderTurnRunner };
	return {
		row,
		turns: {
			assignRunner: vi.fn(
				async (
					_turnId: string,
					from: BuilderTurnRunner,
					to: BuilderTurnRunner,
				) => {
					// A host claim moves the row out of `queued`; no CAS lands then.
					if (row.runner !== from || (claimedByHost && from === "host")) {
						return false;
					}
					row.runner = to;
					return true;
				},
			),
		},
	};
}

function fakeTrigger() {
	return {
		cancel: vi.fn(async (_turnId: string, _handle: TurnRunHandle) => undefined),
		start: vi.fn(
			async (_input: TurnTaskStartInput): Promise<TurnRunHandle> => ({
				runId: "run-1",
				runner: "trigger",
			}),
		),
	} satisfies TurnTaskStarter;
}

function fakeHost(startError?: Error) {
	return {
		cancelTurn: vi.fn(async (_turnId: string) => undefined),
		startTurn: vi.fn(async (_input: TurnTaskStartInput) => {
			if (startError !== undefined) {
				throw startError;
			}
			return true;
		}),
	} satisfies HarnessHostCalls;
}

const logger = { info: vi.fn(), warn: vi.fn() };

describe("RoutingTurnTaskStarter.start", () => {
	it("gives the row to a healthy host and never calls Trigger", async () => {
		const { row, turns } = fakeRow();
		const host = fakeHost();
		const trigger = fakeTrigger();
		const starter = new RoutingTurnTaskStarter(trigger, host, turns, logger);

		const handle = await starter.start(INPUT);

		expect(handle).toEqual({ runner: "host" });
		expect(row.runner).toBe("host");
		expect(host.startTurn).toHaveBeenCalledWith(INPUT);
		expect(trigger.start).not.toHaveBeenCalled();
	});

	it("moves the row back and falls back to Trigger when the host call fails", async () => {
		const { row, turns } = fakeRow();
		const trigger = fakeTrigger();
		const starter = new RoutingTurnTaskStarter(
			trigger,
			fakeHost(new Error("connect ECONNREFUSED")),
			turns,
			logger,
		);

		const handle = await starter.start(INPUT);

		expect(handle).toEqual({ runId: "run-1", runner: "trigger" });
		expect(row.runner).toBe("trigger");
		expect(logger.info).toHaveBeenCalledWith("builder-turn.path", {
			path: "trigger",
			reason: "host_start_failed",
			turnId: INPUT.turnId,
		});
	});

	it("keeps the turn on the host when the host claimed it before its answer was lost", async () => {
		const { turns } = fakeRow(true);
		const trigger = fakeTrigger();
		const starter = new RoutingTurnTaskStarter(
			trigger,
			fakeHost(new Error("timeout")),
			turns,
			logger,
		);

		const handle = await starter.start(INPUT);

		expect(handle).toEqual({ runner: "host" });
		expect(trigger.start).not.toHaveBeenCalled();
	});

	it("sends the turn to Trigger with no pause when the host is full", async () => {
		const { row, turns } = fakeRow();
		const host = fakeHost();
		host.startTurn.mockResolvedValue(false);
		const starter = new RoutingTurnTaskStarter(
			fakeTrigger(),
			host,
			turns,
			logger,
		);

		const handle = await starter.start(INPUT);
		await starter.start(INPUT);

		expect(handle).toEqual({ runId: "run-1", runner: "trigger" });
		expect(row.runner).toBe("trigger");
		expect(logger.info).toHaveBeenCalledWith("builder-turn.path", {
			path: "trigger",
			reason: "host_full",
			turnId: INPUT.turnId,
		});
		expect(host.startTurn).toHaveBeenCalledTimes(2);
	});

	it("skips the host for 30 s after a failed start", async () => {
		let now = 1_000;
		const host = fakeHost(new Error("down"));
		const starter = new RoutingTurnTaskStarter(
			fakeTrigger(),
			host,
			fakeRow().turns,
			logger,
			() => now,
		);
		await starter.start(INPUT);

		now += 29_000;
		await starter.start(INPUT);
		expect(host.startTurn).toHaveBeenCalledTimes(1);

		now += 1_000;
		await starter.start(INPUT);
		expect(host.startTurn).toHaveBeenCalledTimes(2);
	});

	it("starts on Trigger when no host is configured", async () => {
		const { row, turns } = fakeRow();
		const trigger = fakeTrigger();
		const starter = createTurnTaskStarter(trigger, turns, logger, {
			HARNESS_HOST_SECRET: undefined,
			HARNESS_HOST_URL: undefined,
		});

		await starter.start(INPUT);

		expect(trigger.start).toHaveBeenCalledWith(INPUT);
		expect(turns.assignRunner).not.toHaveBeenCalled();
		expect(row.runner).toBe("trigger");
	});
});

describe("RoutingTurnTaskStarter.cancel", () => {
	it("sends a host cancel to the host and a Trigger cancel to Trigger", async () => {
		const host = fakeHost();
		const trigger = fakeTrigger();
		const starter = new RoutingTurnTaskStarter(
			trigger,
			host,
			fakeRow().turns,
			logger,
		);

		await starter.cancel("turn-1", { runner: "host" });
		await starter.cancel("turn-2", { runId: "run-2", runner: "trigger" });

		expect(host.cancelTurn).toHaveBeenCalledWith("turn-1");
		expect(trigger.cancel).toHaveBeenCalledWith("turn-2", {
			runId: "run-2",
			runner: "trigger",
		});
	});

	it("logs a failed host cancel and does not throw", async () => {
		const host = fakeHost();
		host.cancelTurn.mockRejectedValue(new Error("down"));
		const starter = new RoutingTurnTaskStarter(
			fakeTrigger(),
			host,
			fakeRow().turns,
			logger,
		);

		await expect(
			starter.cancel("turn-1", { runner: "host" }),
		).resolves.toBeUndefined();
		expect(logger.warn).toHaveBeenCalledWith(
			"builder-turn.host-cancel-failed",
			{ message: "down", turnId: "turn-1" },
		);
	});
});

describe("HarnessHostClient", () => {
	it("posts the start body with the bearer secret to the turn route", async () => {
		const fetchFn = vi.fn<typeof fetch>(
			async () => new Response(null, { status: 202 }),
		);
		const client = new HarnessHostClient(
			"http://127.0.0.1:3940",
			"s".repeat(32),
			fetchFn,
		);

		await client.startTurn(INPUT);

		const [url, init] = fetchFn.mock.calls[0] ?? [];
		expect(String(url)).toBe(
			`http://127.0.0.1:3940/turns/${INPUT.turnId}/start`,
		);
		expect(init?.headers).toMatchObject({
			authorization: `Bearer ${"s".repeat(32)}`,
		});
		expect(JSON.parse(String(init?.body))).toEqual(INPUT);
	});

	it("throws on an answer that is not 2xx", async () => {
		const client = new HarnessHostClient(
			"http://127.0.0.1:3940",
			"s".repeat(32),
			async () => new Response(null, { status: 401 }),
		);

		await expect(client.cancelTurn("turn-1")).rejects.toThrow("401");
	});
});
