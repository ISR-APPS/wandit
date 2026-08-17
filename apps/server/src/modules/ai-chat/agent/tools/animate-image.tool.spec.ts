import { createHash } from "node:crypto";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	isR2Configured,
	isUserUploadUrl,
} from "../../../../infrastructure/storage/r2";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { MeteringStateConflictError } from "../../../metering/domain/metering";
import {
	type AvailableImage,
	createAnimateImageTool,
} from "./animate-image.tool";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test",
	AI_VIDEO_MODEL: "klingai/kling-v2.6-i2v",
	R2_PUBLIC_BASE_URL: "https://assets.example.com",
	TRIGGER_SECRET_KEY: "tr_dev_test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("@trigger.dev/sdk", () => ({
	idempotencyKeys: { create: vi.fn() },
	tasks: { trigger: vi.fn() },
}));

vi.mock("../../../../infrastructure/storage/r2", () => ({
	isR2Configured: vi.fn(),
	isUserUploadUrl: vi.fn(),
}));

const SOURCE = {
	mediaType: "image/png" as const,
	url: "https://assets.example.com/uploads/user_1/upload_1/product.png",
};

const INPUT = {
	aspect: "9:16" as const,
	motion: "balanced" as const,
	prompt: "Slow camera push while the fabric moves naturally.",
	sourceImageUrl: SOURCE.url,
	sourceMediaType: SOURCE.mediaType,
};
const VIDEO_SUBMISSION_ID = "de890510-e194-4a18-8d4a-a30f80dbe32a";
const REQUEST_KEY = createHash("sha256")
	.update(
		JSON.stringify({
			aspect: INPUT.aspect,
			motion: INPUT.motion,
			request: VIDEO_SUBMISSION_ID,
			sourceImageUrl: SOURCE.url,
			sourceMediaType: SOURCE.mediaType,
		}),
	)
	.digest("hex");

function setup(
	availableImages: AvailableImage[] = [SOURCE],
	selectedSourceImage?: AvailableImage,
) {
	const mediaGenerationsRepository = {
		insertAttempt: vi.fn(),
		markAttemptTriggered: vi.fn(),
		markAttemptFailed: vi.fn().mockResolvedValue(true),
	};
	const usageEvent = { id: "usage_event_1" } as Awaited<
		ReturnType<MeteringService["reserve"]>
	>;
	const meteringService = {
		captureGeneration: vi.fn().mockResolvedValue(null),
		findByIdempotencyKey: vi.fn().mockResolvedValue(usageEvent),
		refund: vi.fn().mockResolvedValue(usageEvent),
		reserveWithReplay: vi.fn().mockResolvedValue({
			event: usageEvent,
			replay: "none",
			replayed: false,
		}),
		settle: vi.fn().mockResolvedValue(usageEvent),
	};
	const animateImageTool = createAnimateImageTool({
		availableImages,
		chatId: "chat_1",
		mediaGenerationsRepository:
			mediaGenerationsRepository as unknown as MediaGenerationsRepository,
		meteringService: meteringService as unknown as MeteringService,
		projectId: "project_1",
		requestKeySeed: VIDEO_SUBMISSION_ID,
		selectedSourceImage,
		subject: { actorUserId: "user_1" },
		userId: "user_1",
	});
	const run = animateImageTool.execute;

	if (!run) {
		throw new Error("animate_image tool must have execute");
	}

	const execute = (toolCallId = "call_1") =>
		run(INPUT, {
			messages: [],
			toolCallId,
		} as unknown as Parameters<typeof run>[1]);

	return {
		execute,
		mediaGenerationsRepository,
		meteringService,
	};
}

beforeEach(() => {
	mockEnv.AI_GATEWAY_API_KEY = "gateway_test";
	mockEnv.AI_VIDEO_MODEL = "klingai/kling-v2.6-i2v";
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
	mockEnv.TRIGGER_SECRET_KEY = "tr_dev_test";
	vi.mocked(isR2Configured).mockReset();
	vi.mocked(isR2Configured).mockReturnValue(true);
	vi.mocked(isUserUploadUrl).mockReset();
	vi.mocked(isUserUploadUrl).mockReturnValue(true);
	vi.mocked(idempotencyKeys.create).mockReset();
	vi.mocked(idempotencyKeys.create).mockResolvedValue(
		"global-image-animation-key" as Awaited<
			ReturnType<typeof idempotencyKeys.create>
		>,
	);
	vi.mocked(tasks.trigger).mockReset();
});

describe("animate_image tool", () => {
	it("answers unavailable without creating a row when video is unconfigured", async () => {
		const { execute, mediaGenerationsRepository } = setup();
		mockEnv.AI_VIDEO_MODEL = "";

		const output = await execute();

		expect(output).toMatchObject({ status: "unavailable" });
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
	});

	it("answers unavailable without Trigger.dev credentials", async () => {
		const { execute, mediaGenerationsRepository } = setup();
		mockEnv.TRIGGER_SECRET_KEY = "";

		const output = await execute();

		expect(output).toMatchObject({ status: "unavailable" });
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("rejects a source that is not an eligible transcript attachment", async () => {
		const { execute, mediaGenerationsRepository } = setup([]);

		const output = await execute();

		expect(output).toMatchObject({ status: "unavailable" });
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
		expect(isUserUploadUrl).not.toHaveBeenCalled();
	});

	it("rejects an attachment outside the authenticated user's upload prefix", async () => {
		const { execute, mediaGenerationsRepository } = setup();
		vi.mocked(isUserUploadUrl).mockReturnValue(false);

		const output = await execute();

		expect(isUserUploadUrl).toHaveBeenCalledWith(SOURCE.url, "user_1");
		expect(output).toMatchObject({ status: "unavailable" });
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
	});

	it("cannot substitute a context image for the dedicated source selection", async () => {
		const otherSource = {
			mediaType: "image/jpeg" as const,
			url: "https://assets.example.com/uploads/user_1/upload_2/context.jpg",
		};
		const { execute, mediaGenerationsRepository } = setup(
			[SOURCE, otherSource],
			otherSource,
		);

		const output = await execute();

		expect(output).toMatchObject({ status: "unavailable" });
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
	});

	it("persists first, then propagates a typed 402 without queueing", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});
		const paymentRequired = new InsufficientCreditsError(25, 0);
		meteringService.reserveWithReplay.mockRejectedValue(paymentRequired);

		await expect(execute()).rejects.toBe(paymentRequired);

		expect(mediaGenerationsRepository.insertAttempt).toHaveBeenCalledTimes(1);
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"video",
			{ actorUserId: "user_1" },
			{
				attemptRef: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
				// 2_000 centi-credits = the 20.00-credit video price.
				credits: 2_000,
				idempotencyKey: "video:b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
				parentEventId: undefined,
			},
		);
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("does not queue a new attempt when its reservation already reconciled", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});
		meteringService.reserveWithReplay.mockResolvedValueOnce({
			event: { id: "usage_event_1", status: "reconciled" },
			replay: "reconciled",
			replayed: true,
		});

		await expect(execute()).rejects.toBeInstanceOf(MeteringStateConflictError);
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("persists the exact request, queues it once, and returns the attempt", async () => {
		const { execute, mediaGenerationsRepository } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_123",
		} as Awaited<ReturnType<typeof tasks.trigger>>);

		const output = await execute();

		expect(mediaGenerationsRepository.insertAttempt).toHaveBeenCalledWith({
			aspect: "9:16",
			chatId: "chat_1",
			motion: "balanced",
			projectId: "project_1",
			prompt: INPUT.prompt,
			requestKey: REQUEST_KEY,
			sourceImageUrl: SOURCE.url,
			sourceMediaType: "image/png",
		});
		expect(idempotencyKeys.create).toHaveBeenCalledWith(
			"image-animation:b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			{ scope: "global" },
		);
		expect(tasks.trigger).toHaveBeenCalledWith(
			"animate-image",
			{
				attemptId: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
				billingMode: "enforce",
				organizationId: null,
				projectId: "project_1",
				userId: "user_1",
			},
			{
				idempotencyKey: "global-image-animation-key",
				idempotencyKeyTTL: "14d",
				tags: [
					"media-attempt:b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
					"project:project_1",
				],
				ttl: "25m",
			},
		);
		expect(
			mediaGenerationsRepository.markAttemptTriggered,
		).toHaveBeenCalledWith("b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3", "run_123");
		expect(output).toMatchObject({
			attemptId: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});
	});

	it("returns an existing result without enqueueing the provider job again", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: false,
			id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "succeeded",
		});

		const output = await execute();

		expect(output).toMatchObject({
			attemptId: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});
		expect(tasks.trigger).not.toHaveBeenCalled();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("reuses the attempt and stable Trigger key after a lost-stream retry", async () => {
		const { execute, mediaGenerationsRepository } = setup();
		mediaGenerationsRepository.insertAttempt
			.mockResolvedValueOnce({
				created: true,
				id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
				status: "queued",
			})
			.mockResolvedValueOnce({
				created: false,
				id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
				status: "queued",
			});
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_123",
		} as Awaited<ReturnType<typeof tasks.trigger>>);

		await execute("call_original");
		await execute("call_after_stream_retry");

		const requestKeys = mediaGenerationsRepository.insertAttempt.mock.calls.map(
			([input]) => input.requestKey,
		);
		expect(requestKeys).toEqual([REQUEST_KEY, REQUEST_KEY]);
		expect(idempotencyKeys.create).toHaveBeenCalledTimes(2);
		expect(idempotencyKeys.create).toHaveBeenNthCalledWith(
			1,
			"image-animation:b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			{ scope: "global" },
		);
		expect(idempotencyKeys.create).toHaveBeenNthCalledWith(
			2,
			"image-animation:b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			{ scope: "global" },
		);
		expect(tasks.trigger).toHaveBeenCalledTimes(2);
	});

	it("keeps an ambiguous Trigger handoff queued without refunding", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});
		vi.mocked(tasks.trigger).mockRejectedValue(
			new Error("Trigger response lost"),
		);

		const output = await execute();

		expect(tasks.trigger).toHaveBeenCalledTimes(3);
		expect(mediaGenerationsRepository.markAttemptFailed).not.toHaveBeenCalled();
		expect(meteringService.refund).not.toHaveBeenCalled();
		expect(output).toMatchObject({
			attemptId: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});
	});

	it("closes and refunds a definitive Trigger rejection immediately", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});
		const rejection = Object.assign(new Error("Invalid Trigger credentials"), {
			name: "TriggerApiError",
			status: 401,
		});
		vi.mocked(tasks.trigger).mockRejectedValue(rejection);

		const output = await execute();

		expect(tasks.trigger).toHaveBeenCalledTimes(1);
		expect(mediaGenerationsRepository.markAttemptFailed).toHaveBeenCalledWith(
			"b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			"The background generator rejected this request. Please try again.",
			"user_1",
		);
		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			"video:b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			{ actorUserId: "user_1" },
		);
		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"image_animation_failed",
		);
		expect(output).toMatchObject({ status: "unavailable" });
	});

	it("recovers an accepted handoff by retrying the same Trigger key", async () => {
		const { execute, mediaGenerationsRepository } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});
		vi.mocked(tasks.trigger)
			.mockRejectedValueOnce(new Error("response lost"))
			.mockResolvedValueOnce({
				id: "run_accepted_before_response_loss",
			} as Awaited<ReturnType<typeof tasks.trigger>>);

		const output = await execute();

		expect(tasks.trigger).toHaveBeenCalledTimes(2);
		expect(vi.mocked(tasks.trigger).mock.calls[0]?.[2]).toMatchObject({
			idempotencyKey: "global-image-animation-key",
		});
		expect(vi.mocked(tasks.trigger).mock.calls[1]?.[2]).toMatchObject({
			idempotencyKey: "global-image-animation-key",
		});
		expect(
			mediaGenerationsRepository.markAttemptTriggered,
		).toHaveBeenCalledWith(
			"b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			"run_accepted_before_response_loss",
		);
		expect(output).toMatchObject({
			attemptId: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});
	});

	it("stays queued when only diagnostic run-id persistence loses a race", async () => {
		const { execute, mediaGenerationsRepository } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_123",
		} as Awaited<ReturnType<typeof tasks.trigger>>);
		mediaGenerationsRepository.markAttemptTriggered.mockRejectedValue(
			new Error("row is already generating"),
		);

		const output = await execute();

		expect(output).toMatchObject({
			attemptId: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});
		expect(mediaGenerationsRepository.markAttemptFailed).not.toHaveBeenCalled();
	});
});
