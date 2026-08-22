import { createHash } from "node:crypto";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import type { AnimateImageInput } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	isR2Configured,
	isUserUploadUrl,
} from "../../../../infrastructure/storage/r2";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import { prepareVideoSourceImage } from "../../../media-generations/application/services/prepare-video-source-image";
import type { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { MeteringStateConflictError } from "../../../metering/domain/metering";
import {
	type AvailableImage,
	createAnimateImageTool,
} from "./animate-image.tool";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test",
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

vi.mock(
	"../../../media-generations/application/services/prepare-video-source-image",
	() => ({ prepareVideoSourceImage: vi.fn() }),
);

const SOURCE = {
	mediaType: "image/png" as const,
	url: "https://assets.example.com/uploads/user_1/upload_1/product.png",
};
const PREPARED_SOURCE = {
	mediaType: "image/jpeg" as const,
	url: "https://assets.example.com/uploads/user_1/upload_1/product.video-src-f50714c0.jpg",
};

const INPUT = {
	aspect: "9:16" as const,
	motion: "balanced" as const,
	prompt: "Slow camera push while the fabric moves naturally.",
	quality: "standard" as const,
	sourceImageUrl: SOURCE.url,
	sourceMediaType: SOURCE.mediaType,
	talking: false,
} satisfies AnimateImageInput;
const VIDEO_SUBMISSION_ID = "de890510-e194-4a18-8d4a-a30f80dbe32a";
const REQUEST_KEY = createHash("sha256")
	.update(
		JSON.stringify({
			aspect: INPUT.aspect,
			clip: 0,
			motion: INPUT.motion,
			request: VIDEO_SUBMISSION_ID,
			sourceImageUrl: PREPARED_SOURCE.url,
			sourceMediaType: PREPARED_SOURCE.mediaType,
		}),
	)
	.digest("hex");

function setup(
	availableImages: AvailableImage[] = [SOURCE],
	selectedSourceImage?: AvailableImage,
	input: AnimateImageInput = INPUT,
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

	const execute = (
		toolCallId = "call_1",
		executeInput: AnimateImageInput = input,
	) =>
		run(executeInput, {
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
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
	mockEnv.TRIGGER_SECRET_KEY = "tr_dev_test";
	vi.mocked(isR2Configured).mockReset();
	vi.mocked(isR2Configured).mockReturnValue(true);
	vi.mocked(isUserUploadUrl).mockReset();
	vi.mocked(isUserUploadUrl).mockReturnValue(true);
	vi.mocked(prepareVideoSourceImage).mockReset();
	vi.mocked(prepareVideoSourceImage).mockResolvedValue({
		height: 1_200,
		mediaType: PREPARED_SOURCE.mediaType,
		repaired: true,
		status: "ready",
		url: PREPARED_SOURCE.url,
		width: 800,
	});
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
		mockEnv.AI_GATEWAY_API_KEY = "";

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
		expect(prepareVideoSourceImage).not.toHaveBeenCalled();
	});

	it("rejects an invalid source before creating an attempt or reserving credits", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		vi.mocked(prepareVideoSourceImage).mockResolvedValueOnce({
			reasonCode: "aspect_extreme",
			status: "rejected",
			userMessage:
				"This image is 8192×512 px (16:1). Please send a less stretched image.",
		});

		const output = await execute();

		expect(prepareVideoSourceImage).toHaveBeenCalledWith({
			modelId: "klingai/kling-v2.6-i2v",
			sourceUrl: SOURCE.url,
			userId: "user_1",
		});
		expect(output).toMatchObject({
			message: expect.stringContaining("8192×512 px"),
			status: "unavailable",
		});
		expect(output).toMatchObject({
			message: expect.stringContaining("ask for a different photo"),
		});
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it.each([
		{
			input: { ...INPUT, quality: "max" as const },
			name: "an explicit max tier",
			talking: false,
		},
		{
			input: { ...INPUT, talking: true },
			name: "a talking-person upgrade",
			talking: true,
		},
	])("uses the resolved max model for preflight and persistence for $name", async ({
		input,
		talking,
	}) => {
		const { execute, mediaGenerationsRepository } = setup(
			[SOURCE],
			undefined,
			input,
		);
		mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: false,
			id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "succeeded",
		});

		await execute();

		expect(prepareVideoSourceImage).toHaveBeenCalledWith({
			modelId: "klingai/kling-v3.0-i2v",
			sourceUrl: SOURCE.url,
			userId: "user_1",
		});
		expect(mediaGenerationsRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "klingai/kling-v3.0-i2v",
				quality: "max",
				talking,
			}),
		);
	});

	it("maps a transient source preparation failure without touching billing", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		vi.mocked(prepareVideoSourceImage).mockRejectedValueOnce(
			new Error("R2 temporarily unavailable"),
		);

		const output = await execute();

		expect(output).toEqual({
			message:
				"The video request could not be saved on the server. Tell the user and offer to retry in a moment.",
			status: "unavailable",
		});
		expect(JSON.stringify(output)).not.toContain("R2 temporarily unavailable");
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
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

	it("persists the prepared source in the request key and attempt before queueing", async () => {
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

		expect(isUserUploadUrl).toHaveBeenCalledTimes(1);
		expect(isUserUploadUrl).toHaveBeenCalledWith(SOURCE.url, "user_1");
		expect(mediaGenerationsRepository.insertAttempt).toHaveBeenCalledWith({
			aspect: "9:16",
			chatId: "chat_1",
			model: "klingai/kling-v2.6-i2v",
			motion: "balanced",
			projectId: "project_1",
			prompt: INPUT.prompt,
			quality: "standard",
			requestKey: REQUEST_KEY,
			sourceImageUrl: PREPARED_SOURCE.url,
			sourceMediaType: "image/jpeg",
			talking: false,
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

	it("separates same-turn clips while a fresh-instance retry dedupes the first", async () => {
		const firstTurn = setup();
		firstTurn.mediaGenerationsRepository.insertAttempt
			.mockResolvedValueOnce({
				created: true,
				id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
				status: "queued",
			})
			.mockResolvedValueOnce({
				created: true,
				id: "c59efb76-24b3-4ce9-bf90-e12d5cce2f4a",
				status: "queued",
			});
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_123",
		} as Awaited<ReturnType<typeof tasks.trigger>>);

		const first = await firstTurn.execute("call_first");
		const sibling = await firstTurn.execute("call_second", {
			...INPUT,
			talking: true,
		});

		const siblingKeys =
			firstTurn.mediaGenerationsRepository.insertAttempt.mock.calls.map(
				([input]) => input.requestKey,
			);
		expect(siblingKeys[0]).toBe(REQUEST_KEY);
		expect(siblingKeys[1]).not.toBe(siblingKeys[0]);
		expect(first).toMatchObject({
			attemptId: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
		});
		expect(sibling).toMatchObject({
			attemptId: "c59efb76-24b3-4ce9-bf90-e12d5cce2f4a",
		});

		const retry = setup();
		retry.mediaGenerationsRepository.insertAttempt.mockResolvedValueOnce({
			created: false,
			id: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
			status: "queued",
		});

		const retriedFirst = await retry.execute("call_after_stream_retry");

		expect(
			retry.mediaGenerationsRepository.insertAttempt.mock.calls[0]?.[0]
				.requestKey,
		).toBe(siblingKeys[0]);
		expect(retriedFirst).toMatchObject({
			attemptId: "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3",
		});
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
