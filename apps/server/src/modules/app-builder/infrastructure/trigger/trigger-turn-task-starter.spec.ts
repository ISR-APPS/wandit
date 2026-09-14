import { ServiceUnavailableException } from "@nestjs/common";
import { idempotencyKeys, runs, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TriggerTurnTaskStarter } from "./trigger-turn-task-starter";

vi.mock("@trigger.dev/sdk", () => ({
	idempotencyKeys: { create: vi.fn(async (key: string) => key) },
	runs: { cancel: vi.fn(async () => undefined) },
	tasks: { trigger: vi.fn(async () => ({ id: "run-1" })) },
}));

const createKeyMock = vi.mocked(idempotencyKeys.create);
const triggerMock = vi.mocked(tasks.trigger);
const cancelMock = vi.mocked(runs.cancel);
const INITIAL_TRIGGER_SECRET_KEY = env.TRIGGER_SECRET_KEY;

const INPUT = {
	actorUserId: "user-1",
	organizationId: "org-1",
	projectId: "project-1",
	turnId: "turn-1",
} as const;

beforeEach(() => {
	vi.clearAllMocks();
	// The starter throws V2_ENV_MISSING without the key; most cases need one.
	// SAFETY: the env object may be process.env (skipValidation), where only
	// deleteProperty models a missing key — assignment coerces to a string.
	(env as { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
		"trigger-secret";
	triggerMock.mockResolvedValue({ id: "run-1" } as never);
	createKeyMock.mockResolvedValue("key-1" as never);
	cancelMock.mockResolvedValue(undefined as never);
});

afterEach(() => {
	if (INITIAL_TRIGGER_SECRET_KEY === undefined) {
		Reflect.deleteProperty(env, "TRIGGER_SECRET_KEY");
	} else {
		// SAFETY: restores the value the process had before the suite ran.
		(env as { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
			INITIAL_TRIGGER_SECRET_KEY;
	}
});

describe("TriggerTurnTaskStarter.start", () => {
	it("queues builder-turn with turn idempotency and project concurrency", async () => {
		const starter = new TriggerTurnTaskStarter();

		const result = await starter.start(INPUT);

		expect(result).toEqual({ runId: "run-1" });
		expect(createKeyMock).toHaveBeenCalledWith("builder-turn:turn-1", {
			scope: "global",
		});
		expect(triggerMock).toHaveBeenCalledWith(
			"builder-turn",
			{
				actorUserId: "user-1",
				organizationId: "org-1",
				projectId: "project-1",
				turnId: "turn-1",
			},
			expect.objectContaining({
				concurrencyKey: "project-1",
				idempotencyKeyTTL: "1h",
				tags: ["builder-turn:turn-1", "project:project-1"],
			}),
		);
	});

	it("throws V2_ENV_MISSING without a Trigger key and never calls the API", async () => {
		// deleteProperty, not `= undefined`: on process.env the assignment
		// would coerce to the truthy string "undefined".
		Reflect.deleteProperty(env, "TRIGGER_SECRET_KEY");
		const starter = new TriggerTurnTaskStarter();

		await expect(starter.start(INPUT)).rejects.toBeInstanceOf(
			ServiceUnavailableException,
		);
		expect(triggerMock).not.toHaveBeenCalled();
	});

	it("retries a transient failure and stops on a definitive 4xx", async () => {
		const definitive = Object.assign(new Error("rejected"), {
			name: "TriggerApiError",
			status: 404,
		});
		triggerMock
			.mockRejectedValueOnce(new Error("socket hang up"))
			.mockRejectedValueOnce(definitive)
			.mockResolvedValueOnce({ id: "run-2" } as never);
		const starter = new TriggerTurnTaskStarter();

		await expect(starter.start(INPUT)).rejects.toThrow("rejected");
		expect(triggerMock).toHaveBeenCalledTimes(2);
	});
});

describe("TriggerTurnTaskStarter.cancel", () => {
	it("swallows a remote cancel failure", async () => {
		cancelMock.mockRejectedValue(new Error("trigger api down"));
		const starter = new TriggerTurnTaskStarter();

		await expect(starter.cancel("run-1")).resolves.toBeUndefined();
		expect(cancelMock).toHaveBeenCalledWith("run-1");
	});
});
