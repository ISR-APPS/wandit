import { createHash } from "node:crypto";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import {
	type ExtendVideoInput,
	type ExtendVideoOutput,
	extendVideoInputSchema,
} from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
import { buildContinuationPrompt } from "../../../media-generations/domain/video-edit-extension-prompts";
import { VIDEO_QUALITY_MODELS } from "../../../media-generations/domain/video-quality-models";
import type {
	MediaGenerationAttemptRow,
	MediaGenerationsRepository,
} from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { createExtendVideoTool } from "./extend-video.tool";

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
}));

const SOURCE_ATTEMPT_ID = "11111111-1111-4111-8111-111111111111";
const EXTENSION_ATTEMPT_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_KEY_SEED = "submission_1";
const INPUT = {
	acceptSilent: false,
	continuationBrief:
		"The runner follows the same path while the sunrise slowly brightens",
	legCount: 3,
	legDurationSeconds: 5,
	sourceAttemptId: SOURCE_ATTEMPT_ID,
	title: "Longer sunrise run",
	voiceover: {
		language: "en",
		script: "Keep moving forward, one steady step at a time.",
	},
} satisfies ExtendVideoInput;

const SOURCE: MediaGenerationAttemptRow = {
	actualDurationMs: 10_032,
	aspect: "16:9" as const,
	chainDepth: 0,
	completedAt: new Date("2026-08-20T12:01:00.000Z"),
	createdAt: new Date("2026-08-20T12:00:00.000Z"),
	durationSeconds: 10,
	error: null,
	id: SOURCE_ATTEMPT_ID,
	kind: "text-to-video" as const,
	model: "klingai/kling-v2.6-t2v",
	motion: null,
	projectId: "project_1",
	prompt: "Original provider prompt",
	quality: "standard",
	sourceAttemptId: null,
	sourceDurationMs: null,
	sourceImageUrl: null,
	sourceMediaType: null,
	sourceVideoMediaType: null,
	sourceVideoUrl: null,
	startedAt: new Date("2026-08-20T12:00:05.000Z"),
	status: "succeeded" as const,
	talking: false,
	title: "Original clip",
	videoMediaType: "video/mp4",
	videoUrl:
		"https://assets.example.com/projects/project_1/videos/source/vid-1.mp4",
	voiceover: null,
};

function setup(options?: {
	input?: ExtendVideoInput;
	requestKeySeed?: string;
	source?: MediaGenerationAttemptRow | null;
}) {
	const mediaGenerationsRepository = {
		findSucceededForProject: vi
			.fn()
			.mockResolvedValue(
				options?.source === undefined ? SOURCE : options.source,
			),
		insertExtensionAttempt: vi.fn().mockResolvedValue({
			created: false,
			id: EXTENSION_ATTEMPT_ID,
			status: "succeeded",
		}),
		markAttemptFailed: vi.fn().mockResolvedValue(true),
		markAttemptTriggered: vi.fn(),
	};
	const usageEvent = {
		id: "usage_event_1",
		operation: "video",
		reservedCredits: 6_000,
		status: "reserved",
	};
	const meteringService = {
		captureGeneration: vi.fn().mockResolvedValue(null),
		findByIdempotencyKey: vi.fn().mockResolvedValue(null),
		refund: vi.fn().mockResolvedValue(usageEvent),
		reserveWithReplay: vi.fn().mockResolvedValue({
			event: usageEvent,
			replay: "none",
			replayed: false,
		}),
		settle: vi.fn().mockResolvedValue(usageEvent),
		settleFixedFromEvidence: vi.fn().mockResolvedValue(usageEvent),
	};
	const extendVideoTool = createExtendVideoTool({
		chatId: "chat_1",
		mediaGenerationsRepository:
			mediaGenerationsRepository as unknown as MediaGenerationsRepository,
		meteringService: meteringService as unknown as MeteringService,
		parentEventId: "parent_1",
		projectId: "project_1",
		requestKeySeed: options?.requestKeySeed ?? REQUEST_KEY_SEED,
		subject: { actorUserId: "user_1", organizationId: "org_1" },
		userId: "user_1",
	});
	const run = extendVideoTool.execute;

	if (!run) {
		throw new Error("extend_video tool must have execute");
	}

	const execute = async (
		input: ExtendVideoInput = options?.input ?? INPUT,
		toolCallId = "call_1",
	): Promise<ExtendVideoOutput> =>
		(await run(input, {
			messages: [],
			toolCallId,
		} as unknown as Parameters<typeof run>[1])) as ExtendVideoOutput;

	return {
		execute,
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
	vi.mocked(auth.createPublicToken).mockReset();
	vi.mocked(auth.createPublicToken).mockResolvedValue("tok_read");
	vi.mocked(idempotencyKeys.create).mockReset();
	vi.mocked(idempotencyKeys.create).mockResolvedValue(
		"global-extend-video-key" as Awaited<
			ReturnType<typeof idempotencyKeys.create>
		>,
	);
	vi.mocked(tasks.trigger).mockReset();
	vi.mocked(tasks.trigger).mockResolvedValue({
		id: "run_123",
	} as Awaited<ReturnType<typeof tasks.trigger>>);
});

describe("extend_video tool", () => {
	it("defaults silent acceptance to false", () => {
		expect(
			extendVideoInputSchema.parse({
				continuationBrief: INPUT.continuationBrief,
				sourceAttemptId: SOURCE_ATTEMPT_ID,
				title: INPUT.title,
			}),
		).toMatchObject({ acceptSilent: false });
	});

	it("atomically snapshots the parent and three resolved leg rows, reserves three units, and queues", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		mediaGenerationsRepository.insertExtensionAttempt.mockResolvedValueOnce({
			created: true,
			id: EXTENSION_ATTEMPT_ID,
			status: "queued",
		});

		const output = await execute();

		const requestKey = createHash("sha256")
			.update(
				JSON.stringify({
					clip: 0,
					request: REQUEST_KEY_SEED,
					sourceAttemptId: SOURCE_ATTEMPT_ID,
					legCount: 3,
					legDurationSeconds: 5,
				}),
			)
			.digest("hex");
		expect(
			mediaGenerationsRepository.findSucceededForProject,
		).toHaveBeenCalledWith("project_1", SOURCE_ATTEMPT_ID);
		expect(
			mediaGenerationsRepository.insertExtensionAttempt,
		).toHaveBeenCalledWith(
			{
				aspect: "16:9",
				chainDepth: 3,
				chatId: "chat_1",
				durationSeconds: 25,
				kind: "video-extension",
				model: VIDEO_QUALITY_MODELS.standard.i2v,
				motion: null,
				projectId: "project_1",
				prompt: buildContinuationPrompt(INPUT.continuationBrief),
				quality: "standard",
				requestKey,
				sourceAttemptId: SOURCE_ATTEMPT_ID,
				sourceImageUrl: null,
				sourceMediaType: null,
				sourceVideoMediaType: "video/mp4",
				sourceVideoUrl: SOURCE.videoUrl,
				talking: false,
				title: INPUT.title,
				voiceover: INPUT.voiceover,
			},
			[
				{
					durationSeconds: 5,
					model: VIDEO_QUALITY_MODELS.standard.i2v,
					seq: 1,
				},
				{
					durationSeconds: 5,
					model: VIDEO_QUALITY_MODELS.standard.i2v,
					seq: 2,
				},
				{
					durationSeconds: 5,
					model: VIDEO_QUALITY_MODELS.standard.i2v,
					seq: 3,
				},
			],
		);
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"video",
			{ actorUserId: "user_1", organizationId: "org_1" },
			expect.objectContaining({
				attemptRef: EXTENSION_ATTEMPT_ID,
				credits: 6_000,
				idempotencyKey: `video:${EXTENSION_ATTEMPT_ID}`,
				parentEventId: "parent_1",
			}),
		);
		expect(idempotencyKeys.create).toHaveBeenCalledWith(
			`video-extend:${EXTENSION_ATTEMPT_ID}`,
			{ scope: "global" },
		);
		expect(tasks.trigger).toHaveBeenCalledWith(
			"extend-video",
			{
				attemptId: EXTENSION_ATTEMPT_ID,
				billingMode: "enforce",
				organizationId: "org_1",
				parentEventId: "parent_1",
				projectId: "project_1",
				userId: "user_1",
			},
			expect.objectContaining({
				idempotencyKey: "global-extend-video-key",
				idempotencyKeyTTL: "14d",
				ttl: "25m",
			}),
		);
		expect(
			mediaGenerationsRepository.markAttemptTriggered,
		).toHaveBeenCalledWith(EXTENSION_ATTEMPT_ID, "run_123");
		expect(output).toMatchObject({
			attemptId: EXTENSION_ATTEMPT_ID,
			realtime: { publicAccessToken: "tok_read", runId: "run_123" },
			status: "queued",
		});
		expect(output.message).toContain("3 5-second pieces");
		expect(output.message).toContain("continuous narration track");
	});

	it("refuses a request that exceeds the remaining lifetime chain depth", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup({
			input: { ...INPUT, legCount: 2 },
			source: { ...SOURCE, chainDepth: 2 },
		});

		const output = await execute({ ...INPUT, legCount: 2 });

		expect(output).toMatchObject({
			message: expect.stringContaining("room for 1 more addition"),
			status: "unavailable",
		});
		expect(output.message).toContain("at most 3 additions");
		expect(
			mediaGenerationsRepository.insertExtensionAttempt,
		).not.toHaveBeenCalled();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("refuses a talking source and offers a fresh longer clip", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup({
			source: { ...SOURCE, talking: true },
		});

		const output = await execute();

		expect(output).toMatchObject({
			message: expect.stringContaining("lip-sync would break"),
			status: "unavailable",
		});
		expect(output.message).toContain("fresh longer clip");
		expect(
			mediaGenerationsRepository.insertExtensionAttempt,
		).not.toHaveBeenCalled();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("refuses a narrated source without a replacement voiceover or silent confirmation", async () => {
		const input = { ...INPUT, voiceover: null };
		const { execute, mediaGenerationsRepository, meteringService } = setup({
			input,
			source: {
				...SOURCE,
				voiceover: {
					language: "en",
					script: "The original narration remains with this source clip.",
				},
			},
		});

		const output = await execute();

		expect(output).toMatchObject({
			message: expect.stringContaining(
				"extending it without a new voiceover would remove that narration",
			),
			status: "unavailable",
		});
		expect(output.message).toContain("FULL new length");
		expect(output.message).toContain("plain confirmation");
		expect(output.message).toContain("acceptSilent: true");
		expect(
			mediaGenerationsRepository.insertExtensionAttempt,
		).not.toHaveBeenCalled();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("queues a narrated source after explicit confirmation that silent is fine", async () => {
		const input = { ...INPUT, acceptSilent: true, voiceover: null };
		const { execute, mediaGenerationsRepository } = setup({
			input,
			source: {
				...SOURCE,
				voiceover: {
					language: "en",
					script: "The original narration remains with this source clip.",
				},
			},
		});
		mediaGenerationsRepository.insertExtensionAttempt.mockResolvedValueOnce({
			created: true,
			id: EXTENSION_ATTEMPT_ID,
			status: "queued",
		});

		const output = await execute();

		expect(output.status).toBe("queued");
		expect(
			mediaGenerationsRepository.insertExtensionAttempt,
		).toHaveBeenCalledWith(
			expect.objectContaining({ voiceover: null }),
			expect.any(Array),
		);
		expect(tasks.trigger).toHaveBeenCalledTimes(1);
	});

	it("queues a narrated source with a full replacement voiceover", async () => {
		const { execute, mediaGenerationsRepository } = setup({
			source: {
				...SOURCE,
				voiceover: {
					language: "en",
					script: "The original narration remains with this source clip.",
				},
			},
		});
		mediaGenerationsRepository.insertExtensionAttempt.mockResolvedValueOnce({
			created: true,
			id: EXTENSION_ATTEMPT_ID,
			status: "queued",
		});

		const output = await execute();

		expect(output.status).toBe("queued");
		expect(
			mediaGenerationsRepository.insertExtensionAttempt,
		).toHaveBeenCalledWith(
			expect.objectContaining({ voiceover: INPUT.voiceover }),
			expect.any(Array),
		);
		expect(tasks.trigger).toHaveBeenCalledTimes(1);
	});

	it("rejects foreign-project and non-MP4 sources without queueing", async () => {
		const foreign = setup({ source: null });

		const foreignOutput = await foreign.execute();

		expect(foreignOutput).toMatchObject({
			message: expect.stringContaining(
				"not a finished video made in this project",
			),
			status: "unavailable",
		});
		expect(
			foreign.mediaGenerationsRepository.insertExtensionAttempt,
		).not.toHaveBeenCalled();

		const webm = setup({
			source: { ...SOURCE, videoMediaType: "video/webm" },
		});
		const webmOutput = await webm.execute();

		expect(webmOutput).toMatchObject({
			message: expect.stringContaining("format cannot be extended yet"),
			status: "unavailable",
		});
		expect(webmOutput.message).toContain("MP4");
		expect(
			webm.mediaGenerationsRepository.insertExtensionAttempt,
		).not.toHaveBeenCalled();
	});

	it("includes leg count and leg duration in the stable request key", async () => {
		const oneShortLeg = setup({
			input: { ...INPUT, legCount: 1, legDurationSeconds: 5 },
		});
		const twoLongLegs = setup({
			input: { ...INPUT, legCount: 2, legDurationSeconds: 10 },
		});

		await oneShortLeg.execute({
			...INPUT,
			legCount: 1,
			legDurationSeconds: 5,
		});
		await twoLongLegs.execute({
			...INPUT,
			legCount: 2,
			legDurationSeconds: 10,
		});

		const shortKey =
			oneShortLeg.mediaGenerationsRepository.insertExtensionAttempt.mock
				.calls[0]?.[0].requestKey;
		const longKey =
			twoLongLegs.mediaGenerationsRepository.insertExtensionAttempt.mock
				.calls[0]?.[0].requestKey;
		expect(shortKey).toBe(
			createHash("sha256")
				.update(
					JSON.stringify({
						clip: 0,
						request: REQUEST_KEY_SEED,
						sourceAttemptId: SOURCE_ATTEMPT_ID,
						legCount: 1,
						legDurationSeconds: 5,
					}),
				)
				.digest("hex"),
		);
		expect(longKey).not.toBe(shortKey);
	});

	it("returns the generic queued-collision receipt without billing or handoff", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		mediaGenerationsRepository.insertExtensionAttempt.mockResolvedValueOnce({
			created: false,
			id: EXTENSION_ATTEMPT_ID,
			status: "queued",
		});

		const output = await execute();

		expect(output).toEqual({
			attemptId: EXTENSION_ATTEMPT_ID,
			message:
				"This video extension was already accepted. Its existing progress card appears in the conversation.",
			status: "queued",
		});
		expect(output.message).not.toContain(INPUT.continuationBrief);
		expect(output.message).not.toContain(INPUT.title);
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("refunds the full reservation after a definitive Trigger rejection", async () => {
		const { execute, mediaGenerationsRepository, meteringService, usageEvent } =
			setup();
		mediaGenerationsRepository.insertExtensionAttempt.mockResolvedValueOnce({
			created: true,
			id: EXTENSION_ATTEMPT_ID,
			status: "queued",
		});
		meteringService.findByIdempotencyKey
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(usageEvent);
		const rejection = Object.assign(new Error("invalid task"), {
			name: "TriggerApiError",
			status: 400,
		});
		vi.mocked(tasks.trigger).mockRejectedValueOnce(rejection);

		const output = await execute();

		expect(meteringService.reserveWithReplay).toHaveBeenCalledTimes(1);
		expect(mediaGenerationsRepository.markAttemptFailed).toHaveBeenCalledWith(
			EXTENSION_ATTEMPT_ID,
			"The background extension worker rejected this request. Please try again.",
			"user_1",
		);
		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"video_extension_failed",
		);
		expect(output).toMatchObject({
			message: expect.stringContaining("not queued"),
			status: "unavailable",
		});
	});
});
