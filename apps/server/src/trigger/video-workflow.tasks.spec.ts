import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const close = vi.fn();
	const metadata = {
		get: vi.fn(),
		set: vi.fn(),
	};
	metadata.set.mockReturnValue(metadata);
	return {
		close,
		createDb: vi.fn(() => ({ $client: { end: close } })),
		createProgress: vi.fn(() => ({
			finish: vi.fn(),
			report: vi.fn(),
			stop: vi.fn(),
		})),
		createRuntime: vi.fn(() => ({ runner: { runtime: true } })),
		info: vi.fn(),
		metadata,
		queue: vi.fn((definition: unknown) => definition),
		runWorkflow: vi.fn(),
		schemaTask: vi.fn((definition: unknown) => definition),
		triggerAnalytics: { capture: vi.fn() },
	};
});

vi.mock("@trigger.dev/sdk", () => ({
	logger: { info: mocks.info },
	metadata: mocks.metadata,
	queue: mocks.queue,
	schemaTask: mocks.schemaTask,
}));
vi.mock("@wandit/db", () => ({ createDb: mocks.createDb }));
vi.mock("./undici-timeouts", () => ({}));
vi.mock(
	"../modules/media-generations/application/services/video-edit-extension-runner",
	() => ({
		parseVideoWorkflowPayload: vi.fn((value: unknown) => value),
		runVideoWorkflow: mocks.runWorkflow,
	}),
);
vi.mock("./init", () => ({ triggerAnalytics: mocks.triggerAnalytics }));
vi.mock("./video-edit-extension.runtime", () => ({
	createVideoWorkflowRuntime: mocks.createRuntime,
}));
vi.mock("./video-workflow-progress", () => ({
	createVideoWorkflowProgressTracker: mocks.createProgress,
}));

import { editVideoTask } from "./edit-video.task";
import { extendVideoTask } from "./extend-video.task";

type CapturedTask = {
	id: string;
	maxDuration: number;
	queue: unknown;
	retry: { maxAttempts: number };
	run: (
		payload: Record<string, unknown>,
		context: { ctx: { run: { id: string } }; signal: AbortSignal },
	) => Promise<unknown>;
	ttl: string;
};

const edit = editVideoTask as unknown as CapturedTask;
const extend = extendVideoTask as unknown as CapturedTask;
const payload = {
	attemptId: "11111111-1111-4111-8111-111111111111",
	projectId: "22222222-2222-4222-8222-222222222222",
	userId: "user_1",
};

describe("video edit/extension Trigger tasks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.metadata.set.mockReturnValue(mocks.metadata);
		mocks.runWorkflow.mockResolvedValue({
			mediaType: "video/mp4",
			recovered: false,
			status: "succeeded",
			url: "https://assets.test/final.mp4",
		});
	});

	it("shares the video queue and keeps the requested duration/retry envelopes", () => {
		expect(edit).toMatchObject({
			id: "edit-video",
			maxDuration: 900,
			retry: { maxAttempts: 12 },
			ttl: "25m",
		});
		expect(extend).toMatchObject({
			id: "extend-video",
			maxDuration: 1800,
			retry: { maxAttempts: 12 },
			ttl: "25m",
		});
		expect(edit.queue).toBe(extend.queue);
		expect(edit.queue).toEqual({
			concurrencyLimit: 2,
			name: "video-generation",
		});
	});

	it.each([
		[edit, "video-edit"],
		[extend, "video-extension"],
	] as const)("routes %s through the shared parent runner", async (task, kind) => {
		const signal = new AbortController().signal;
		await task.run(payload, { ctx: { run: { id: "run_1" } }, signal });

		expect(mocks.runWorkflow).toHaveBeenCalledWith(
			payload,
			expect.objectContaining({
				expectedKind: kind,
				runId: "run_1",
				signal,
			}),
		);
		expect(mocks.close).toHaveBeenCalledTimes(1);
	});
});
