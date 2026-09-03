import { createHash } from "node:crypto";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import type { ProductVideoInput, ProductVideoOutput } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	isR2Configured,
	isUserUploadUrl,
} from "../../../../infrastructure/storage/r2";
import type { ImageGenerationsRepository } from "../../../image-generations/infrastructure/persistence/image-generations.repository";
import { prepareVideoSourceImage } from "../../../media-generations/application/services/prepare-video-source-image";
import { buildProductVideoPrompt } from "../../../media-generations/domain/product-video-prompts";
import { VIDEO_PRODUCT_ENGINE_MODEL } from "../../../media-generations/domain/video-quality-models";
import type { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { createProductVideoTool } from "./product-video.tool";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test",
	GENERATION_BILLING_MODE: "enforce",
	R2_PUBLIC_BASE_URL: "https://assets.example.com",
	TRIGGER_SECRET_KEY: "tr_dev_test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("@trigger.dev/sdk", () => ({
	auth: { createPublicToken: vi.fn() },
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

const ATTEMPT_ID = "22222222-2222-4222-8222-222222222222";
const ATTACHMENT = {
	mediaType: "image/webp" as const,
	url: "https://assets.example.com/uploads/user_1/upload_1/product.webp",
};
const GENERATED_URL =
	"https://assets.example.com/sites/project_1/assets/image-attempt/product.png";
const PREPARED = {
	height: 1_200,
	mediaType: "image/jpeg" as const,
	repaired: true,
	status: "ready" as const,
	url: "https://assets.example.com/uploads/user_1/upload_1/product.video-src.jpg",
	width: 800,
};
const INPUT = {
	image: ATTACHMENT,
	preset: "orbit",
	productDetails: "Matte black aluminum body with one silver dial.",
	productName: "Arc One",
	title: "Arc One product film",
} satisfies ProductVideoInput;
const REQUEST_KEY_SEED = "submission_1";

function setup(options?: {
	availableImages?: Array<typeof ATTACHMENT>;
	generatedImage?: { mediaType: string; url: string } | null;
	input?: ProductVideoInput;
}) {
	const imageGenerationsRepository = {
		findSucceededImageByUrlForProject: vi
			.fn()
			.mockResolvedValue(options?.generatedImage ?? null),
	};
	const mediaGenerationsRepository = {
		insertAttempt: vi.fn().mockResolvedValue({
			created: false,
			id: ATTEMPT_ID,
			status: "succeeded",
		}),
		markAttemptFailed: vi.fn().mockResolvedValue(true),
		markAttemptTriggered: vi.fn(),
	};
	const usageEvent = {
		id: "usage_event_1",
		operation: "video",
		reservedCredits: 550,
		status: "reserved",
	};
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
		settleFixedFromEvidence: vi.fn().mockResolvedValue(usageEvent),
	};
	const productVideoTool = createProductVideoTool({
		availableImages: options?.availableImages ?? [ATTACHMENT],
		chatId: "chat_1",
		imageGenerationsRepository:
			imageGenerationsRepository as unknown as ImageGenerationsRepository,
		mediaGenerationsRepository:
			mediaGenerationsRepository as unknown as MediaGenerationsRepository,
		meteringService: meteringService as unknown as MeteringService,
		parentEventId: "parent_1",
		projectId: "project_1",
		requestKeySeed: REQUEST_KEY_SEED,
		subject: { actorUserId: "user_1", organizationId: "org_1" },
		userId: "user_1",
	});
	const run = productVideoTool.execute;

	if (!run) {
		throw new Error("product_video tool must have execute");
	}

	const execute = async (
		input: ProductVideoInput = options?.input ?? INPUT,
		toolCallId = "call_1",
	): Promise<ProductVideoOutput> =>
		(await run(input, {
			messages: [],
			toolCallId,
		} as unknown as Parameters<typeof run>[1])) as ProductVideoOutput;

	return {
		execute,
		imageGenerationsRepository,
		mediaGenerationsRepository,
		meteringService,
		usageEvent,
	};
}

beforeEach(() => {
	mockEnv.AI_GATEWAY_API_KEY = "gateway_test";
	mockEnv.GENERATION_BILLING_MODE = "enforce";
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
	mockEnv.TRIGGER_SECRET_KEY = "tr_dev_test";
	vi.mocked(isR2Configured).mockReset();
	vi.mocked(isR2Configured).mockReturnValue(true);
	vi.mocked(isUserUploadUrl).mockReset();
	vi.mocked(isUserUploadUrl).mockReturnValue(true);
	vi.mocked(prepareVideoSourceImage).mockReset();
	vi.mocked(prepareVideoSourceImage).mockResolvedValue(PREPARED);
	vi.mocked(idempotencyKeys.create).mockReset();
	vi.mocked(idempotencyKeys.create).mockResolvedValue(
		"global-product-video-key" as Awaited<
			ReturnType<typeof idempotencyKeys.create>
		>,
	);
	vi.mocked(tasks.trigger).mockReset();
	vi.mocked(tasks.trigger).mockResolvedValue({
		id: "run_123",
	} as Awaited<ReturnType<typeof tasks.trigger>>);
	vi.mocked(auth.createPublicToken).mockReset();
	vi.mocked(auth.createPublicToken).mockResolvedValue("tok_read");
});

describe("product_video tool", () => {
	it("authorizes an exact transcript attachment, prepares it under the user prefix, and queues one fixed render", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValueOnce({
			created: true,
			id: ATTEMPT_ID,
			status: "queued",
		});

		const output = await execute();
		const requestKey = createHash("sha256")
			.update(
				JSON.stringify({
					clip: 0,
					preset: INPUT.preset,
					request: REQUEST_KEY_SEED,
					sourceImageUrl: PREPARED.url,
				}),
			)
			.digest("hex");

		expect(isUserUploadUrl).toHaveBeenCalledWith(ATTACHMENT.url, "user_1");
		expect(prepareVideoSourceImage).toHaveBeenCalledWith({
			modelId: VIDEO_PRODUCT_ENGINE_MODEL,
			sourceUrl: ATTACHMENT.url,
			userId: "user_1",
		});
		expect(mediaGenerationsRepository.insertAttempt).toHaveBeenCalledWith({
			aspect: "9:16",
			chainDepth: 0,
			chatId: "chat_1",
			durationSeconds: 5,
			kind: "video-product",
			model: VIDEO_PRODUCT_ENGINE_MODEL,
			motion: null,
			projectId: "project_1",
			prompt: buildProductVideoPrompt({
				preset: INPUT.preset,
				productDetails: INPUT.productDetails,
				productName: INPUT.productName,
			}),
			quality: null,
			requestKey,
			sourceAttemptId: null,
			sourceImageUrl: PREPARED.url,
			sourceMediaType: "image/jpeg",
			sourceVideoMediaType: null,
			sourceVideoUrl: null,
			talking: null,
			title: INPUT.title,
			voiceover: null,
		});
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"video",
			{ actorUserId: "user_1", organizationId: "org_1" },
			expect.objectContaining({
				attemptRef: ATTEMPT_ID,
				idempotencyKey: `video:${ATTEMPT_ID}`,
				measuredTerms: { estimatedUnitUsdMicros: null, units: 1 },
				parentEventId: "parent_1",
			}),
		);
		expect(idempotencyKeys.create).toHaveBeenCalledWith(
			`video-product:${ATTEMPT_ID}`,
			{ scope: "global" },
		);
		expect(tasks.trigger).toHaveBeenCalledWith(
			"product-video",
			expect.objectContaining({
				attemptId: ATTEMPT_ID,
				billingMode: "enforce",
				projectId: "project_1",
				userId: "user_1",
			}),
			expect.objectContaining({
				idempotencyKey: "global-product-video-key",
				idempotencyKeyTTL: "14d",
				ttl: "25m",
			}),
		);
		expect(output).toMatchObject({
			attemptId: ATTEMPT_ID,
			realtime: { publicAccessToken: "tok_read", runId: "run_123" },
			status: "queued",
		});
	});

	it("requires exact URL and media-type membership for the attachment road", async () => {
		const { execute, imageGenerationsRepository, mediaGenerationsRepository } =
			setup();

		const output = await execute({
			...INPUT,
			image: { ...ATTACHMENT, mediaType: "image/png" },
		});

		expect(output).toMatchObject({
			message: expect.stringContaining("not an eligible product photo"),
			status: "unavailable",
		});
		expect(
			imageGenerationsRepository.findSucceededImageByUrlForProject,
		).not.toHaveBeenCalled();
		expect(prepareVideoSourceImage).not.toHaveBeenCalled();
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
	});

	it("does not trust transcript membership without the authenticated upload guard", async () => {
		vi.mocked(isUserUploadUrl).mockReturnValue(false);
		const { execute, imageGenerationsRepository, mediaGenerationsRepository } =
			setup({ generatedImage: null });

		const output = await execute();

		expect(isUserUploadUrl).toHaveBeenCalledWith(ATTACHMENT.url, "user_1");
		expect(
			imageGenerationsRepository.findSucceededImageByUrlForProject,
		).toHaveBeenCalledWith("project_1", ATTACHMENT.url);
		expect(output).toMatchObject({ status: "unavailable" });
		expect(prepareVideoSourceImage).not.toHaveBeenCalled();
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
	});

	it("uses the project-scoped generated-image row and its authoritative media type", async () => {
		vi.mocked(isUserUploadUrl).mockReturnValue(false);
		const generated = { mediaType: "image/png", url: GENERATED_URL };
		const { execute, imageGenerationsRepository, mediaGenerationsRepository } =
			setup({ generatedImage: generated });

		await execute({
			...INPUT,
			image: { mediaType: "image/jpeg", url: GENERATED_URL },
		});

		expect(
			imageGenerationsRepository.findSucceededImageByUrlForProject,
		).toHaveBeenCalledWith("project_1", GENERATED_URL);
		expect(prepareVideoSourceImage).toHaveBeenCalledWith({
			modelId: VIDEO_PRODUCT_ENGINE_MODEL,
			sourceUrl: GENERATED_URL,
		});
		expect(prepareVideoSourceImage).not.toHaveBeenCalledWith(
			expect.objectContaining({ userId: expect.anything() }),
		);
		expect(mediaGenerationsRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceImageUrl: PREPARED.url,
				sourceMediaType: PREPARED.mediaType,
			}),
		);
	});

	it("refuses an unauthorized URL without an attempt or reservation", async () => {
		vi.mocked(isUserUploadUrl).mockReturnValue(false);
		const { execute, mediaGenerationsRepository, meteringService } = setup({
			availableImages: [],
			generatedImage: null,
		});

		const output = await execute({
			...INPUT,
			image: { url: "https://public.example.com/not-authorized.png" },
		});

		expect(output).toMatchObject({ status: "unavailable" });
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("relays a preparation rejection before persistence or billing", async () => {
		vi.mocked(prepareVideoSourceImage).mockResolvedValueOnce({
			reasonCode: "aspect_extreme",
			status: "rejected",
			userMessage:
				"This image is 8192×512 px (16:1). Please send a less stretched image.",
		});
		const { execute, mediaGenerationsRepository, meteringService } = setup();

		const output = await execute();

		expect(output.message).toContain("8192×512 px");
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("dedupes a same-seed queued retry while excluding model-authored product fields", async () => {
		const first = setup();
		first.mediaGenerationsRepository.insertAttempt.mockResolvedValueOnce({
			created: true,
			id: ATTEMPT_ID,
			status: "queued",
		});
		const retry = setup();
		retry.mediaGenerationsRepository.insertAttempt.mockResolvedValueOnce({
			created: false,
			id: ATTEMPT_ID,
			status: "queued",
		});

		await first.execute(INPUT, "call_original");
		const replay = await retry.execute(
			{
				...INPUT,
				productDetails: "Recomposed details",
				productName: "Recomposed name",
				title: "Recomposed title",
			},
			"call_retry",
		);

		expect(
			first.mediaGenerationsRepository.insertAttempt.mock.calls[0]?.[0]
				.requestKey,
		).toBe(
			retry.mediaGenerationsRepository.insertAttempt.mock.calls[0]?.[0]
				.requestKey,
		);
		expect(retry.meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(replay).toMatchObject({ attemptId: ATTEMPT_ID, status: "queued" });
		expect(tasks.trigger).toHaveBeenCalledTimes(1);
	});

	it("refunds a failed dedupe without starting a new reservation", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValueOnce({
			created: false,
			id: ATTEMPT_ID,
			status: "failed",
		});

		const output = await execute();

		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			`video:${ATTEMPT_ID}`,
			{ actorUserId: "user_1", organizationId: "org_1" },
		);
		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"product_video_failed",
		);
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(output).toMatchObject({ status: "unavailable" });
	});

	it("closes and refunds a definitive Trigger rejection", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValueOnce({
			created: true,
			id: ATTEMPT_ID,
			status: "queued",
		});
		vi.mocked(tasks.trigger).mockRejectedValueOnce(
			Object.assign(new Error("invalid task"), {
				name: "TriggerApiError",
				status: 422,
			}),
		);

		const output = await execute();

		expect(mediaGenerationsRepository.markAttemptFailed).toHaveBeenCalledWith(
			ATTEMPT_ID,
			"The background generator rejected this request. Please try again.",
			"user_1",
		);
		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"product_video_failed",
		);
		expect(output).toMatchObject({
			message: expect.stringContaining("not queued"),
			status: "unavailable",
		});
	});
});
