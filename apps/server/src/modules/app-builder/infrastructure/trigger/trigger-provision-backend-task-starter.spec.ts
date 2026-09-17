import { ServiceUnavailableException } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TriggerProvisionBackendTaskStarter } from "./trigger-provision-backend-task-starter";

vi.mock("@trigger.dev/sdk", () => ({
	idempotencyKeys: { create: vi.fn(async (key: string) => key) },
	tasks: { trigger: vi.fn(async () => ({ id: "run-1" })) },
}));

const createKeyMock = vi.mocked(idempotencyKeys.create);
const triggerMock = vi.mocked(tasks.trigger);
const INITIAL_TRIGGER_SECRET_KEY = env.TRIGGER_SECRET_KEY;

const INPUT = {
	projectId: "project-1",
	requestKey: "request-1",
} as const;

beforeEach(() => {
	vi.clearAllMocks();
	// The starter throws V2_ENV_MISSING without the key; most cases need one.
	// SAFETY: the env object may be process.env (skipValidation), where only
	// deleteProperty models a missing key — assignment coerces to a string.
	(env as { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
		"trigger-secret";
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
		// SAFETY: restores the value the process had before the suite ran.
		(env as { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
			INITIAL_TRIGGER_SECRET_KEY;
	}
});

describe("TriggerProvisionBackendTaskStarter.start", () => {
	it("queues provision-backend with request-key idempotency", async () => {
		const starter = new TriggerProvisionBackendTaskStarter();

		const result = await starter.start(INPUT);

		expect(result).toEqual({ runId: "run-1" });
		expect(createKeyMock).toHaveBeenCalledWith("provision-backend:request-1", {
			scope: "global",
		});
		expect(triggerMock).toHaveBeenCalledWith(
			"provision-backend",
			{
				projectId: "project-1",
				requestKey: "request-1",
			},
			expect.objectContaining({
				idempotencyKeyTTL: "1h",
				tags: ["project:project-1"],
			}),
		);
	});

	it("throws V2_ENV_MISSING without a Trigger key and never calls the API", async () => {
		// deleteProperty, not `= undefined`: on process.env the assignment
		// would coerce to the truthy string "undefined".
		Reflect.deleteProperty(env, "TRIGGER_SECRET_KEY");
		const starter = new TriggerProvisionBackendTaskStarter();

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
		const starter = new TriggerProvisionBackendTaskStarter();

		await expect(starter.start(INPUT)).rejects.toThrow("payload rejected");
		expect(triggerMock).toHaveBeenCalledTimes(1);
	});

	it("retries a 500 and throws after the third failure", async () => {
		const transient = Object.assign(new Error("server error"), {
			name: "TriggerApiError",
			status: 500,
		});
		triggerMock.mockRejectedValue(transient);
		const starter = new TriggerProvisionBackendTaskStarter();

		await expect(starter.start(INPUT)).rejects.toThrow("server error");
		expect(triggerMock).toHaveBeenCalledTimes(3);
	});
});
