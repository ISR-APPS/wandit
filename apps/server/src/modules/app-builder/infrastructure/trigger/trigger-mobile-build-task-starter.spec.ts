import { ServiceUnavailableException } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TriggerMobileBuildTaskStarter } from "./trigger-mobile-build-task-starter";

vi.mock("@trigger.dev/sdk", () => ({
	idempotencyKeys: { create: vi.fn(async (key: string) => key) },
	tasks: { trigger: vi.fn(async () => ({ id: "run-1" })) },
}));

const createKeyMock = vi.mocked(idempotencyKeys.create);
const triggerMock = vi.mocked(tasks.trigger);
const INITIAL_TRIGGER_SECRET_KEY = env.TRIGGER_SECRET_KEY;

const INPUT = {
	actorIsLimitExempt: true,
	buildId: "build-1",
	projectId: "project-1",
} as const;

beforeEach(() => {
	vi.clearAllMocks();
	// The starter throws V2_ENV_MISSING without the key; most cases need one.
	Reflect.set(env, "TRIGGER_SECRET_KEY", "trigger-secret");
	// SAFETY: the starter reads only `id`; the SDK handle type carries
	// more fields than the mock answers.
	triggerMock.mockResolvedValue({ id: "run-1" } as never);
	// SAFETY: the starter passes the key through; the SDK brand type adds
	// nothing the code reads.
	createKeyMock.mockResolvedValue("key-1" as never);
});

afterEach(() => {
	if (INITIAL_TRIGGER_SECRET_KEY === undefined) {
		Reflect.deleteProperty(env, "TRIGGER_SECRET_KEY");
	} else {
		Reflect.set(env, "TRIGGER_SECRET_KEY", INITIAL_TRIGGER_SECRET_KEY);
	}
});

describe("TriggerMobileBuildTaskStarter.start", () => {
	it("queues mobile-build with the build id key and the project concurrency key", async () => {
		const starter = new TriggerMobileBuildTaskStarter();

		const result = await starter.start(INPUT);

		expect(result).toEqual({ runId: "run-1" });
		expect(createKeyMock).toHaveBeenCalledWith("mobile-build:build-1", {
			scope: "global",
		});
		expect(triggerMock).toHaveBeenCalledWith(
			"mobile-build",
			{
				actorIsLimitExempt: true,
				buildId: "build-1",
				projectId: "project-1",
			},
			{
				concurrencyKey: "project-1",
				idempotencyKey: "key-1",
				idempotencyKeyTTL: "1h",
				tags: ["project:project-1", "mobile-build:build-1"],
			},
		);
	});

	it("throws V2_ENV_MISSING without a Trigger key and never calls the API", async () => {
		// deleteProperty, not `= undefined`: on process.env the assignment
		// would coerce to the truthy string "undefined".
		Reflect.deleteProperty(env, "TRIGGER_SECRET_KEY");
		const starter = new TriggerMobileBuildTaskStarter();

		await expect(starter.start(INPUT)).rejects.toBeInstanceOf(
			ServiceUnavailableException,
		);
		expect(triggerMock).not.toHaveBeenCalled();
	});

	it("stops after one attempt on a definitive 422", async () => {
		const definitive = Object.assign(new Error("payload rejected"), {
			name: "TriggerApiError",
			status: 422,
		});
		triggerMock.mockRejectedValue(definitive);
		const starter = new TriggerMobileBuildTaskStarter();

		await expect(starter.start(INPUT)).rejects.toThrow("payload rejected");
		expect(triggerMock).toHaveBeenCalledTimes(1);
	});

	it("retries a 500 and throws after the third failure", async () => {
		const transient = Object.assign(new Error("server error"), {
			name: "TriggerApiError",
			status: 500,
		});
		triggerMock.mockRejectedValue(transient);
		const starter = new TriggerMobileBuildTaskStarter();

		await expect(starter.start(INPUT)).rejects.toThrow("server error");
		expect(triggerMock).toHaveBeenCalledTimes(3);
	});
});
