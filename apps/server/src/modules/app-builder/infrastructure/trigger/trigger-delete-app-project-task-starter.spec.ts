import { ServiceUnavailableException } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TriggerDeleteAppProjectTaskStarter } from "./trigger-delete-app-project-task-starter";

vi.mock("@trigger.dev/sdk", () => ({
	idempotencyKeys: { create: vi.fn(async (key: string) => key) },
	tasks: { trigger: vi.fn(async () => ({ id: "run-1" })) },
}));

const createKeyMock = vi.mocked(idempotencyKeys.create);
const triggerMock = vi.mocked(tasks.trigger);
const INITIAL_TRIGGER_SECRET_KEY = env.TRIGGER_SECRET_KEY;

const INPUT = {
	actorUserId: "user-1",
	organizationId: "org-1",
	projectId: "project-1",
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

describe("TriggerDeleteAppProjectTaskStarter.start", () => {
	it("queues delete-app-project with project idempotency", async () => {
		const starter = new TriggerDeleteAppProjectTaskStarter();

		const result = await starter.start(INPUT);

		expect(result).toEqual({ runId: "run-1" });
		expect(createKeyMock).toHaveBeenCalledWith("delete-app-project:project-1", {
			scope: "global",
		});
		expect(triggerMock).toHaveBeenCalledWith(
			"delete-app-project",
			{
				actorUserId: "user-1",
				organizationId: "org-1",
				projectId: "project-1",
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
		const starter = new TriggerDeleteAppProjectTaskStarter();

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
			// SAFETY: the starter reads only `id`; the SDK handle type
			// carries more fields than the mock answers.
			.mockResolvedValueOnce({ id: "run-2" } as never);
		const starter = new TriggerDeleteAppProjectTaskStarter();

		await expect(starter.start(INPUT)).rejects.toThrow("rejected");
		expect(triggerMock).toHaveBeenCalledTimes(2);
	});
});
