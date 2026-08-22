import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import type {
	GenerateVideoInput,
	GenerateVideoOutput,
} from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
import type { VideoDirectorService } from "../../../media-generations/application/services/video-director";
import type { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { createGenerateVideoTool } from "./generate-video.tool";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test",
	GENERATION_BILLING_MODE: "off",
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

const INPUT = {
	aspect: "9:16",
	brief:
		"A precise product launch film showing a red running shoe crossing a rain-lit city street at dawn.",
	durationSeconds: 10,
	multiShot: false,
	quality: "standard",
	talking: false,
	title: "Launch film",
} as const satisfies GenerateVideoInput;

function setup(input: GenerateVideoInput = INPUT) {
	const mediaGenerationsRepository = {
		insertAttempt: vi.fn().mockResolvedValue({
			created: false,
			id: "11111111-1111-4111-8111-111111111111",
			status: "succeeded",
		}),
		markAttemptFailed: vi.fn(),
		markAttemptTriggered: vi.fn(),
	};
	const meteringService = {
		captureGeneration: vi.fn(),
		findByIdempotencyKey: vi.fn().mockResolvedValue(null),
		refund: vi.fn(),
		reserveWithReplay: vi.fn().mockResolvedValue({
			event: {
				id: "usage_event_1",
				reservedCredits: 2_000,
				status: "reserved",
			},
			replay: "none",
			replayed: false,
		}),
		settle: vi.fn(),
		settleFixedFromEvidence: vi.fn(),
	};
	const videoDirector = {
		craftVideoPrompt: vi.fn().mockResolvedValue({
			model: "director/model",
			prompt: "Crafted provider prompt",
		}),
	};
	const videoTool = createGenerateVideoTool({
		chatId: "chat_1",
		mediaGenerationsRepository:
			mediaGenerationsRepository as unknown as MediaGenerationsRepository,
		meteringService: meteringService as unknown as MeteringService,
		projectId: "project_1",
		requestKeySeed: "submission_1",
		subject: { actorUserId: "user_1" },
		userId: "user_1",
		videoDirector: videoDirector as unknown as VideoDirectorService,
	});
	const run = videoTool.execute;

	if (!run) {
		throw new Error("generate_video tool must have execute");
	}

	const execute = async (): Promise<GenerateVideoOutput> =>
		(await run(input, {
			messages: [],
			toolCallId: "call_1",
		} as unknown as Parameters<typeof run>[1])) as GenerateVideoOutput;

	return {
		execute,
		mediaGenerationsRepository,
		meteringService,
		videoDirector,
	};
}

beforeEach(() => {
	mockEnv.AI_GATEWAY_API_KEY = "gateway_test";
	mockEnv.GENERATION_BILLING_MODE = "off";
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
	mockEnv.TRIGGER_SECRET_KEY = "tr_dev_test";
	vi.mocked(isR2Configured).mockReset();
	vi.mocked(isR2Configured).mockReturnValue(true);
	vi.mocked(auth.createPublicToken).mockReset();
	vi.mocked(auth.createPublicToken).mockResolvedValue("tok_read");
	vi.mocked(idempotencyKeys.create).mockReset();
	vi.mocked(idempotencyKeys.create).mockResolvedValue(
		"global-generate-video-key" as Awaited<
			ReturnType<typeof idempotencyKeys.create>
		>,
	);
	vi.mocked(tasks.trigger).mockReset();
	vi.mocked(tasks.trigger).mockResolvedValue({
		id: "run_123",
	} as Awaited<ReturnType<typeof tasks.trigger>>);
});

describe("generate_video tool", () => {
	it("answers unavailable without a gateway key before directing or persisting", async () => {
		mockEnv.AI_GATEWAY_API_KEY = "";
		const { execute, mediaGenerationsRepository, videoDirector } = setup();

		await expect(execute()).resolves.toMatchObject({ status: "unavailable" });
		expect(videoDirector.craftVideoPrompt).not.toHaveBeenCalled();
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
	});

	it.each([
		{
			expectedModel: "klingai/kling-v2.6-t2v",
			input: INPUT,
			quality: "standard",
		},
		{
			expectedModel: "klingai/kling-v3.0-t2v",
			input: { ...INPUT, quality: "max" as const },
			quality: "max",
		},
	])("resolves and persists the $quality tier", async ({
		expectedModel,
		input,
		quality,
	}) => {
		const { execute, mediaGenerationsRepository, videoDirector } = setup(input);

		await execute();

		expect(videoDirector.craftVideoPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ model: expectedModel }),
		);
		expect(mediaGenerationsRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				model: expectedModel,
				quality,
				talking: false,
			}),
		);
	});

	it.each([
		{
			input: { ...INPUT, durationSeconds: 15 as const },
			name: "15 seconds",
		},
		{
			input: { ...INPUT, talking: true },
			name: "a talking person",
		},
		{
			input: { ...INPUT, multiShot: true },
			name: "multiple shots",
		},
		{
			input: {
				...INPUT,
				voiceover: {
					language: "fr" as const,
					script: "Chaque foulée devient plus légère.",
				},
			},
			name: "off-camera narration",
		},
		{
			input: {
				...INPUT,
				durationSeconds: 15 as const,
				multiShot: true,
				talking: true,
			},
			name: "combined max capabilities",
		},
	])("auto-upgrades standard for $name", async ({ input }) => {
		const { execute, mediaGenerationsRepository, videoDirector } = setup(input);

		await execute();

		expect(videoDirector.craftVideoPrompt).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "klingai/kling-v3.0-t2v",
				multiShot: input.multiShot,
				talking: input.talking,
			}),
		);
		expect(mediaGenerationsRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "klingai/kling-v3.0-t2v",
				quality: "max",
				talking: input.talking,
			}),
		);
	});

	it("snapshots the exact native narration line and describes the queued audio honestly", async () => {
		const attemptId = "11111111-1111-4111-8111-111111111111";
		const input = {
			...INPUT,
			voiceover: {
				language: "fr" as const,
				script: "Chaque foulée devient plus légère.",
			},
		};
		const { execute, mediaGenerationsRepository, videoDirector } = setup(input);
		mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: attemptId,
			status: "queued",
		});

		const output = await execute();

		expect(videoDirector.craftVideoPrompt).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "klingai/kling-v3.0-t2v",
				talking: false,
				voiceoverLanguage: "fr",
				voiceoverScript: "Chaque foulée devient plus légère.",
			}),
		);
		expect(mediaGenerationsRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "klingai/kling-v3.0-t2v",
				prompt:
					'Crafted provider prompt\n\nVoiceover narration, calm confident voice, fr: "Chaque foulée devient plus légère."',
				quality: "max",
				talking: false,
				voiceover: input.voiceover,
			}),
		);
		expect(output).toMatchObject({
			attemptId,
			message: expect.stringContaining(
				"The clip will carry the requested narration.",
			),
			status: "queued",
		});
		expect(output.message).not.toContain("renders silent");
	});

	it("keeps a legacy language-only voiceover silent instead of promising audio", async () => {
		const input = {
			...INPUT,
			voiceover: { language: "fr" as const },
		};
		const { execute, mediaGenerationsRepository, videoDirector } = setup(input);
		mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: "11111111-1111-4111-8111-111111111111",
			status: "queued",
		});

		const output = await execute();

		expect(videoDirector.craftVideoPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ model: "klingai/kling-v2.6-t2v" }),
		);
		expect(mediaGenerationsRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: "Crafted provider prompt",
				quality: "standard",
			}),
		);
		expect(output.message).toContain("without an exact script");
		expect(output.message).toContain("renders silent");
		expect(output.message).not.toContain("will carry");
	});

	it("keeps the provider prompt within Kling's cap after appending narration", async () => {
		const input = {
			...INPUT,
			voiceover: {
				language: "en" as const,
				script: "A precise narration line.",
			},
		};
		const { execute, mediaGenerationsRepository, videoDirector } = setup(input);
		videoDirector.craftVideoPrompt.mockResolvedValue({
			model: "director/model",
			prompt: "x".repeat(2_400),
		});

		await execute();

		const prompt = mediaGenerationsRepository.insertAttempt.mock.calls[0]?.[0]
			.prompt as string;
		expect(prompt.length).toBeLessThanOrEqual(2_500);
		expect(prompt).toContain(
			'Voiceover narration, calm confident voice, en: "A precise narration line."',
		);
	});

	it("keeps model-authored tier fields out of the transport request key", async () => {
		const standard = setup(INPUT);
		const maxTalking = setup({
			...INPUT,
			multiShot: true,
			quality: "max",
			talking: true,
		});

		await standard.execute();
		await maxTalking.execute();

		expect(
			standard.mediaGenerationsRepository.insertAttempt.mock.calls[0]?.[0]
				.requestKey,
		).toBe(
			maxTalking.mediaGenerationsRepository.insertAttempt.mock.calls[0]?.[0]
				.requestKey,
		);
	});

	it("returns a queued dedupe without describing or reserving the retry plan", async () => {
		mockEnv.GENERATION_BILLING_MODE = "enforce";
		const attemptId = "11111111-1111-4111-8111-111111111111";
		const persistedInput = {
			...INPUT,
			voiceover: {
				language: "en" as const,
				script: "Off-camera narration for the persisted silent clip.",
			},
		};
		const first = setup(persistedInput);
		first.mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: attemptId,
			status: "queued",
		});
		const retry = setup({
			...persistedInput,
			talking: true,
			voiceover: {
				language: "en",
				script:
					"A newly composed on-camera line that must not describe the row.",
			},
		});
		retry.mediaGenerationsRepository.insertAttempt.mockResolvedValue({
			created: false,
			id: attemptId,
			status: "queued",
		});

		await first.execute();
		const output = await retry.execute();

		expect(
			first.mediaGenerationsRepository.insertAttempt.mock.calls[0]?.[0]
				.requestKey,
		).toBe(
			retry.mediaGenerationsRepository.insertAttempt.mock.calls[0]?.[0]
				.requestKey,
		);
		expect(output).toEqual({
			attemptId,
			message:
				"This video request was already accepted. Its existing progress card appears in the conversation.",
			status: "queued",
		});
		expect(output.message).not.toContain("Voice control");
		expect(output.message).not.toContain("on-camera");
		expect(first.meteringService.reserveWithReplay).toHaveBeenCalledTimes(1);
		expect(retry.meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(tasks.trigger).toHaveBeenCalledTimes(1);
	});
});
