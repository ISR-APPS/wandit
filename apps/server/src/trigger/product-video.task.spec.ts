import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const close = vi.fn();
	const metadata = { get: vi.fn(), set: vi.fn() };
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
		runProductVideo: vi.fn(),
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
	"../modules/media-generations/application/services/product-video-runner",
	() => ({
		parseProductVideoPayload: vi.fn((value: unknown) => value),
		runProductVideo: mocks.runProductVideo,
	}),
);
vi.mock("./init", () => ({ triggerAnalytics: mocks.triggerAnalytics }));
vi.mock("./product-video.runtime", () => ({
	createProductVideoRuntime: mocks.createRuntime,
}));
vi.mock("./video-workflow-progress", () => ({
	createVideoWorkflowProgressTracker: mocks.createProgress,
}));

import { productVideoTask } from "./product-video.task";

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

const task = productVideoTask as unknown as CapturedTask;
const payload = {
	attemptId: "11111111-1111-4111-8111-111111111111",
	projectId: "22222222-2222-4222-8222-222222222222",
	userId: "user_1",
};

describe("product-video Trigger task", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.metadata.set.mockReturnValue(mocks.metadata);
		mocks.runProductVideo.mockResolvedValue({
			mediaType: "video/mp4",
			recovered: false,
			status: "succeeded",
			url: "https://assets.test/product.mp4",
		});
	});

	it("uses the shared video queue and fixed edit-style retry envelope", () => {
		expect(task).toMatchObject({
			id: "product-video",
			maxDuration: 900,
			queue: { concurrencyLimit: 2, name: "video-generation" },
			retry: { maxAttempts: 12 },
			ttl: "25m",
		});
	});

	it("runs the dedicated slim runtime and finishes realtime progress", async () => {
		const signal = new AbortController().signal;
		await task.run(payload, { ctx: { run: { id: "run_1" } }, signal });

		expect(mocks.createProgress).toHaveBeenCalledWith({
			durationSeconds: 5,
			headline: "Preparing the product image…",
		});
		expect(mocks.runProductVideo).toHaveBeenCalledWith(
			payload,
			expect.objectContaining({
				dependencies: { runtime: true },
				runId: "run_1",
				signal,
			}),
		);
		const progress = mocks.createProgress.mock.results[0]?.value;
		expect(progress.finish).toHaveBeenCalledTimes(1);
		expect(progress.stop).toHaveBeenCalledTimes(1);
		expect(mocks.close).toHaveBeenCalledTimes(1);
	});
});
