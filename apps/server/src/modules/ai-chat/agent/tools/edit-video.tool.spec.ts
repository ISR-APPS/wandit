import { createHash } from "node:crypto";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import type { EditVideoInput, EditVideoOutput } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
import { buildEditPrompt } from "../../../media-generations/domain/video-edit-extension-prompts";
import { VIDEO_EDIT_ENGINE_MODEL } from "../../../media-generations/domain/video-quality-models";
import type { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { createEditVideoTool } from "./edit-video.tool";

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
const EDIT_ATTEMPT_ID = "22222222-2222-4222-8222-222222222222";
const SECOND_EDIT_ATTEMPT_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_KEY_SEED = "submission_1";
const INPUT = {
	instruction: "Change only the running shoe from blue to red",
	sourceAttemptId: SOURCE_ATTEMPT_ID,
	title: "Red shoe edit",
} satisfies EditVideoInput;

const SOURCE = {
	actualDurationMs: 10_032,
	aspect: "16:9" as const,
	chainDepth: 1,
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
	input?: EditVideoInput;
	requestKeySeed?: string;
	source?: typeof SOURCE | null;
}) {
	const mediaGenerationsRepository = {
		findSucceededForProject: vi
			.fn()
			.mockResolvedValue(
				options?.source === undefined ? SOURCE : options.source,
			),
		insertAttempt: vi.fn().mockResolvedValue({
			created: false,
			id: EDIT_ATTEMPT_ID,
			status: "succeeded",
		}),
		markAttemptFailed: vi.fn().mockResolvedValue(true),
		markAttemptTriggered: vi.fn(),
	};
	const usageEvent = {
		id: "usage_event_1",
		operation: "video",
		reservedCredits: 2_000,
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
	const editVideoTool = createEditVideoTool({
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
	const run = editVideoTool.execute;

	if (!run) {
		throw new Error("edit_video tool must have execute");
	}

	const execute = async (
		input: EditVideoInput = options?.input ?? INPUT,
		toolCallId = "call_1",
	): Promise<EditVideoOutput> =>
		(await run(input, {
			messages: [],
			toolCallId,
		} as unknown as Parameters<typeof run>[1])) as EditVideoOutput;

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
		"global-edit-video-key" as Awaited<
			ReturnType<typeof idempotencyKeys.create>
		>,
	);
	vi.mocked(tasks.trigger).mockReset();
	vi.mocked(tasks.trigger).mockResolvedValue({
		id: "run_123",
	} as Awaited<ReturnType<typeof tasks.trigger>>);
});

describe("edit_video tool", () => {
	it("snapshots the project-owned source, reserves one unit, and queues the edit", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValueOnce({
			created: true,
			id: EDIT_ATTEMPT_ID,
			status: "queued",
		});

		const output = await execute();

		const requestKey = createHash("sha256")
			.update(
				JSON.stringify({
					clip: 0,
					request: REQUEST_KEY_SEED,
					sourceAttemptId: SOURCE_ATTEMPT_ID,
				}),
			)
			.digest("hex");
		expect(
			mediaGenerationsRepository.findSucceededForProject,
		).toHaveBeenCalledWith("project_1", SOURCE_ATTEMPT_ID);
		expect(mediaGenerationsRepository.insertAttempt).toHaveBeenCalledWith({
			aspect: "16:9",
			chainDepth: 1,
			chatId: "chat_1",
			durationSeconds: 10,
			kind: "video-edit",
			model: VIDEO_EDIT_ENGINE_MODEL,
			motion: null,
			projectId: "project_1",
			prompt: buildEditPrompt(INPUT.instruction),
			quality: null,
			requestKey,
			sourceAttemptId: SOURCE_ATTEMPT_ID,
			sourceImageUrl: null,
			sourceMediaType: null,
			sourceVideoMediaType: "video/mp4",
			sourceVideoUrl: SOURCE.videoUrl,
			talking: null,
			title: INPUT.title,
			voiceover: null,
		});
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"video",
			{ actorUserId: "user_1", organizationId: "org_1" },
			expect.objectContaining({
				attemptRef: EDIT_ATTEMPT_ID,
				idempotencyKey: `video:${EDIT_ATTEMPT_ID}`,
				parentEventId: "parent_1",
			}),
		);
		expect(idempotencyKeys.create).toHaveBeenCalledWith(
			`video-edit:${EDIT_ATTEMPT_ID}`,
			{ scope: "global" },
		);
		expect(tasks.trigger).toHaveBeenCalledWith(
			"edit-video",
			{
				attemptId: EDIT_ATTEMPT_ID,
				billingMode: "enforce",
				organizationId: "org_1",
				parentEventId: "parent_1",
				projectId: "project_1",
				userId: "user_1",
			},
			expect.objectContaining({
				idempotencyKey: "global-edit-video-key",
				idempotencyKeyTTL: "14d",
				ttl: "25m",
			}),
		);
		expect(
			mediaGenerationsRepository.markAttemptTriggered,
		).toHaveBeenCalledWith(EDIT_ATTEMPT_ID, "run_123");
		expect(auth.createPublicToken).toHaveBeenCalledWith({
			expirationTime: "2h",
			scopes: { read: { runs: ["run_123"] } },
		});
		expect(output).toMatchObject({
			attemptId: EDIT_ATTEMPT_ID,
			realtime: { publicAccessToken: "tok_read", runId: "run_123" },
			status: "queued",
		});
	});

	it("rejects a foreign-project source without trusting its public URL", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup({
			source: null,
		});

		const output = await execute();

		expect(
			mediaGenerationsRepository.findSucceededForProject,
		).toHaveBeenCalledWith("project_1", SOURCE_ATTEMPT_ID);
		expect(output).toMatchObject({
			message: expect.stringContaining(
				"not a finished video made in this project",
			),
			status: "unavailable",
		});
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("rejects a WebM source honestly without transcoding or queueing it", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup({
			source: { ...SOURCE, videoMediaType: "video/webm" },
		});

		const output = await execute();

		expect(output).toMatchObject({
			message: expect.stringContaining("format cannot be edited yet"),
			status: "unavailable",
		});
		expect(output.message).toContain("MP4");
		expect(output.message.toLowerCase()).not.toContain("transcod");
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("pre-checks the source duration before persistence or billing", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup({
			source: { ...SOURCE, durationSeconds: 31 },
		});

		const output = await execute();

		expect(output).toMatchObject({
			message: expect.stringContaining("4 through 30 seconds"),
			status: "unavailable",
		});
		expect(mediaGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("dedupes a same-seed retry while keeping model-authored fields out of the key", async () => {
		const first = setup();
		first.mediaGenerationsRepository.insertAttempt.mockResolvedValueOnce({
			created: true,
			id: EDIT_ATTEMPT_ID,
			status: "queued",
		});
		const retry = setup({
			input: {
				...INPUT,
				instruction: "A recomposed instruction that must not defeat dedupe",
				title: "A recomposed title",
			},
		});
		retry.mediaGenerationsRepository.insertAttempt.mockResolvedValueOnce({
			created: false,
			id: EDIT_ATTEMPT_ID,
			status: "queued",
		});

		await first.execute(INPUT, "call_original");
		const replayOutput = await retry.execute(
			{
				...INPUT,
				instruction: "A recomposed instruction that must not defeat dedupe",
				title: "A recomposed title",
			},
			"call_after_stream_retry",
		);

		expect(
			first.mediaGenerationsRepository.insertAttempt.mock.calls[0]?.[0]
				.requestKey,
		).toBe(
			retry.mediaGenerationsRepository.insertAttempt.mock.calls[0]?.[0]
				.requestKey,
		);
		expect(tasks.trigger).toHaveBeenCalledTimes(1);
		expect(replayOutput).toEqual({
			attemptId: EDIT_ATTEMPT_ID,
			message:
				"This video edit was already accepted. Its existing progress card appears in the conversation.",
			status: "queued",
		});
	});

	it("uses the clip ordinal to queue two same-turn edits as distinct attempts", async () => {
		const { execute, mediaGenerationsRepository } = setup();
		mediaGenerationsRepository.insertAttempt
			.mockResolvedValueOnce({
				created: true,
				id: EDIT_ATTEMPT_ID,
				status: "queued",
			})
			.mockResolvedValueOnce({
				created: true,
				id: SECOND_EDIT_ATTEMPT_ID,
				status: "queued",
			});

		const first = await execute(INPUT, "call_first");
		const second = await execute(
			{ ...INPUT, instruction: "Make the laces white" },
			"call_second",
		);

		const requestKeys = mediaGenerationsRepository.insertAttempt.mock.calls.map(
			([input]) => input.requestKey,
		);
		expect(requestKeys).toHaveLength(2);
		expect(requestKeys[1]).not.toBe(requestKeys[0]);
		expect(first).toMatchObject({ attemptId: EDIT_ATTEMPT_ID });
		expect(second).toMatchObject({ attemptId: SECOND_EDIT_ATTEMPT_ID });
		expect(tasks.trigger).toHaveBeenCalledTimes(2);
	});

	it("returns the generic queued-collision receipt without billing or handoff", async () => {
		const { execute, mediaGenerationsRepository, meteringService } = setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValueOnce({
			created: false,
			id: EDIT_ATTEMPT_ID,
			status: "queued",
		});

		const output = await execute();

		expect(output).toEqual({
			attemptId: EDIT_ATTEMPT_ID,
			message:
				"This video edit was already accepted. Its existing progress card appears in the conversation.",
			status: "queued",
		});
		expect(output.message).not.toContain(INPUT.instruction);
		expect(output.message).not.toContain(INPUT.title);
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("refunds the one-unit reservation after a definitive Trigger rejection", async () => {
		const { execute, mediaGenerationsRepository, meteringService, usageEvent } =
			setup();
		mediaGenerationsRepository.insertAttempt.mockResolvedValueOnce({
			created: true,
			id: EDIT_ATTEMPT_ID,
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
			EDIT_ATTEMPT_ID,
			"The background editor rejected this request. Please try again.",
			"user_1",
		);
		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"video_edit_failed",
		);
		expect(output).toMatchObject({
			message: expect.stringContaining("not queued"),
			status: "unavailable",
		});
	});
});
