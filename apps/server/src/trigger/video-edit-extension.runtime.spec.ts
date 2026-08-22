import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	downloadObjectToFile,
	getObjectContentType,
} from "../infrastructure/storage/r2";
import { editVideo } from "../modules/ai-chat/agent/site-builder/edit-video";
import { generateBuildVideo } from "../modules/ai-chat/agent/site-builder/generate-video";
import {
	runVideoWorkflow,
	type VideoWorkflowAttempt,
	VideoWorkflowSettlementPendingError,
} from "../modules/media-generations/application/services/video-edit-extension-runner";
import {
	concatSegments,
	extractLastFrame,
	isMp4VideoProbe,
	muxSoundtrack,
	normalizeSegment,
	probeVideo,
} from "../modules/media-generations/application/services/video-processing";
import {
	createStoredFinalRecovery,
	executeAttempt,
	executeExtension,
} from "./video-edit-extension.runtime";

vi.mock("../infrastructure/storage/r2", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../infrastructure/storage/r2")>();
	return {
		...actual,
		deleteObject: vi.fn().mockResolvedValue(undefined),
		downloadObjectToFile: vi.fn(),
		getObjectContentType: vi.fn(),
		publicAssetKeyFromUrl: vi.fn((url: string) =>
			url.startsWith("https://assets.test/")
				? url.slice("https://assets.test/".length)
				: null,
		),
		publicAssetUrl: vi.fn((key: string) => `https://assets.test/${key}`),
		putSiteFile: vi.fn().mockResolvedValue(undefined),
	};
});

vi.mock("../modules/ai-chat/agent/site-builder/edit-video", () => ({
	editVideo: vi.fn(),
}));

vi.mock("../modules/ai-chat/agent/site-builder/generate-video", () => ({
	generateBuildVideo: vi.fn(),
}));

vi.mock(
	"../modules/media-generations/application/services/video-processing",
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import("../modules/media-generations/application/services/video-processing")
			>();
		return {
			...actual,
			concatSegments: vi.fn(),
			extractLastFrame: vi.fn(),
			isMp4VideoProbe: vi.fn(),
			muxSoundtrack: vi.fn(),
			normalizeSegment: vi.fn(),
			probeVideo: vi.fn(),
		};
	},
);

const BASE_ATTEMPT: VideoWorkflowAttempt = {
	actualDurationMs: null,
	aspect: "16:9",
	chainDepth: 1,
	completedAt: null,
	createdAt: new Date("2026-08-21T00:00:00.000Z"),
	durationSeconds: 20,
	error: null,
	id: "11111111-1111-4111-8111-111111111111",
	kind: "video-extension",
	model: "klingai/kling-v2.6-i2v",
	organizationId: null,
	projectDeletedAt: null,
	projectId: "22222222-2222-4222-8222-222222222222",
	prompt: "Continue this exact scene from the final frame: keep walking.",
	quality: "standard",
	sourceAttemptId: "33333333-3333-4333-8333-333333333333",
	sourceDurationMs: null,
	sourceVideoMediaType: "video/mp4",
	sourceVideoUrl: "https://assets.test/source.mp4",
	startedAt: new Date("2026-08-21T00:01:00.000Z"),
	status: "generating",
	talking: false,
	triggerRunId: "run_1",
	userId: "user_1",
	videoMediaType: null,
	videoUrl: null,
	voiceover: null,
};

const PROBE = {
	durationMs: 10_000,
	fps: 24,
	formatName: "mov,mp4,m4a,3gp,3g2,mj2",
	hasAudio: false,
	height: 720,
	videoCodec: "h264",
	width: 1280,
};

const RESERVATION = {
	credits: 10,
	eventId: "event_1",
	operation: "video" as const,
	referenceId: BASE_ATTEMPT.id,
	replay: "none" as const,
	units: 2 as const,
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(downloadObjectToFile).mockImplementation(async (_key, path) => {
		await writeFile(path, "video");
		return true;
	});
	vi.mocked(getObjectContentType).mockResolvedValue(null);
	vi.mocked(isMp4VideoProbe).mockReturnValue(true);
	vi.mocked(probeVideo).mockResolvedValue(PROBE);
	vi.mocked(extractLastFrame).mockImplementation(async (_source, out) => {
		await writeFile(out, "frame");
	});
	vi.mocked(normalizeSegment).mockImplementation(async (_source, out) => {
		await writeFile(out, "normalized");
	});
	vi.mocked(concatSegments).mockImplementation(async (_paths, out) => {
		await writeFile(out, "joined");
	});
	vi.mocked(muxSoundtrack).mockImplementation(async (_video, _audio, out) => {
		await writeFile(out, "muxed");
	});
	vi.mocked(generateBuildVideo).mockResolvedValue({
		mediaType: "video/mp4",
		model: "klingai/kling-v2.6-i2v",
		providerMetadata: { gateway: { generationId: "gen_2" } },
		status: "generated",
		url: `https://assets.test/sites/${BASE_ATTEMPT.projectId}/assets/${BASE_ATTEMPT.id}/vid-3.mp4`,
	});
});

describe("video edit/extension Trigger runtime", () => {
	it("never reruns a succeeded leg and calls the provider once for the first queued leg", async () => {
		const directory = await mkdtemp(join(tmpdir(), "video-extension-spec-"));
		const sourcePath = join(directory, "source.mp4");
		await writeFile(sourcePath, "source");
		const legs = [
			leg({
				segmentKey: `sites/${BASE_ATTEMPT.projectId}/assets/${BASE_ATTEMPT.id}/segments/segment-1.mp4`,
				seq: 1,
				status: "succeeded",
			}),
			leg({ seq: 2, status: "queued" }),
		];
		const persistence = persistenceFor(legs);

		try {
			const result = await executeExtension(
				BASE_ATTEMPT,
				sourcePath,
				PROBE,
				directory,
				{
					reservation: RESERVATION,
					subject: { actorUserId: "user_1" },
				},
				{
					billing: billing(),
					persistence,
					speech: { synthesizeVoiceover: vi.fn() },
				} as never,
			);

			expect(result).toMatchObject({ deliveredUnits: 2, status: "generated" });
			expect(generateBuildVideo).toHaveBeenCalledTimes(1);
			expect(generateBuildVideo).toHaveBeenCalledWith(
				expect.objectContaining({ durationSeconds: 10, index: 3 }),
			);
			expect(persistence.claimLeg).toHaveBeenCalledWith(BASE_ATTEMPT.id, 2);
		} finally {
			await rm(directory, { force: true, recursive: true });
		}
	});

	it("re-renders a crashed generating leg with no output or provider evidence exactly once", async () => {
		const directory = await mkdtemp(join(tmpdir(), "video-extension-pending-"));
		const sourcePath = join(directory, "source.mp4");
		await writeFile(sourcePath, "source");
		const sourceFrameKey = `sites/${BASE_ATTEMPT.projectId}/assets/${BASE_ATTEMPT.id}/frames/frame-1.jpg`;
		const persistence = persistenceFor([
			leg({
				seq: 1,
				sourceFrameKey,
				status: "generating",
			}),
		]);

		try {
			await expect(
				executeExtension(
					BASE_ATTEMPT,
					sourcePath,
					PROBE,
					directory,
					{
						reservation: { ...RESERVATION, units: 1 },
						subject: { actorUserId: "user_1" },
					},
					{
						billing: billing(),
						persistence,
						speech: { synthesizeVoiceover: vi.fn() },
					} as never,
				),
			).resolves.toMatchObject({ deliveredUnits: 1, status: "generated" });
			expect(persistence.resetLegForRetry).toHaveBeenCalledWith(
				BASE_ATTEMPT.id,
				1,
				sourceFrameKey,
			);
			expect(persistence.claimLeg).toHaveBeenCalledTimes(1);
			expect(generateBuildVideo).toHaveBeenCalledTimes(1);
		} finally {
			await rm(directory, { force: true, recursive: true });
		}
	});

	it("keeps an evidence-without-output leg settlement-pending", async () => {
		const directory = await mkdtemp(
			join(tmpdir(), "video-extension-evidence-"),
		);
		const sourcePath = join(directory, "source.mp4");
		await writeFile(sourcePath, "source");
		const persistence = persistenceFor(
			[
				leg({
					seq: 1,
					sourceFrameKey: `sites/${BASE_ATTEMPT.projectId}/assets/${BASE_ATTEMPT.id}/frames/frame-1.jpg`,
					status: "generating",
				}),
			],
			{ providerEvidenceUnits: 1 },
		);

		try {
			await expect(
				executeExtension(
					BASE_ATTEMPT,
					sourcePath,
					PROBE,
					directory,
					{
						reservation: { ...RESERVATION, units: 1 },
						subject: { actorUserId: "user_1" },
					},
					{
						billing: billing(),
						persistence,
						speech: { synthesizeVoiceover: vi.fn() },
					} as never,
				),
			).rejects.toBeInstanceOf(VideoWorkflowSettlementPendingError);
			expect(persistence.resetLegForRetry).not.toHaveBeenCalled();
			expect(generateBuildVideo).not.toHaveBeenCalled();
		} finally {
			await rm(directory, { force: true, recursive: true });
		}

		const fail = vi.fn();
		await expect(
			runVideoWorkflow(
				{
					attemptId: BASE_ATTEMPT.id,
					projectId: BASE_ATTEMPT.projectId,
					userId: BASE_ATTEMPT.userId,
				},
				{
					dependencies: {
						claimQueued: vi.fn(),
						completedUnitsForAttempt: vi.fn().mockResolvedValue(1),
						execute: vi
							.fn()
							.mockRejectedValue(
								new VideoWorkflowSettlementPendingError(BASE_ATTEMPT.id),
							),
						fail,
						loadAttempt: vi.fn().mockResolvedValue(BASE_ATTEMPT),
						markSucceeded: vi.fn(),
						now: () => new Date(),
						recoverStoredVideo: vi.fn().mockResolvedValue(null),
						refund: vi.fn(),
						reserve: vi.fn().mockResolvedValue({ ...RESERVATION, units: 1 }),
						settle: vi.fn(),
						settleExisting: vi.fn(),
						unitsForAttempt: vi.fn().mockResolvedValue(1),
					},
					expectedKind: "video-extension",
					runId: "run_2",
				},
			),
		).rejects.toBeInstanceOf(VideoWorkflowSettlementPendingError);
		expect(fail).not.toHaveBeenCalled();
	});

	it("resumes a generating leg that never crossed the durable frame boundary", async () => {
		const directory = await mkdtemp(
			join(tmpdir(), "video-extension-pre-frame-"),
		);
		const sourcePath = join(directory, "source.mp4");
		await writeFile(sourcePath, "source");
		const persistence = persistenceFor([leg({ seq: 1, status: "generating" })]);

		try {
			await expect(
				executeExtension(
					{ ...BASE_ATTEMPT, chainDepth: 1 },
					sourcePath,
					PROBE,
					directory,
					{
						reservation: { ...RESERVATION, units: 1 },
						subject: { actorUserId: "user_1" },
					},
					{
						billing: billing(),
						persistence,
						speech: { synthesizeVoiceover: vi.fn() },
					} as never,
				),
			).resolves.toMatchObject({ deliveredUnits: 1, status: "generated" });
			expect(generateBuildVideo).toHaveBeenCalledTimes(1);
			expect(persistence.resetLegForRetry).toHaveBeenCalledTimes(1);
			expect(persistence.recordLegFrame).toHaveBeenCalledTimes(1);
		} finally {
			await rm(directory, { force: true, recursive: true });
		}
	});

	it("normalizes a stored raw leg on retry without repeating its provider call", async () => {
		const directory = await mkdtemp(join(tmpdir(), "video-extension-raw-"));
		const sourcePath = join(directory, "source.mp4");
		await writeFile(sourcePath, "source");
		const persistence = persistenceFor([
			leg({
				seq: 1,
				sourceFrameKey: `sites/${BASE_ATTEMPT.projectId}/assets/${BASE_ATTEMPT.id}/frames/frame-1.jpg`,
				status: "generating",
			}),
		]);
		vi.mocked(getObjectContentType).mockImplementation(async (key) =>
			key.endsWith("/vid-2.mp4") ? "video/mp4" : null,
		);

		try {
			await expect(
				executeExtension(
					BASE_ATTEMPT,
					sourcePath,
					PROBE,
					directory,
					{
						reservation: { ...RESERVATION, units: 1 },
						subject: { actorUserId: "user_1" },
					},
					{
						billing: billing(),
						persistence,
						speech: { synthesizeVoiceover: vi.fn() },
					} as never,
				),
			).resolves.toMatchObject({ deliveredUnits: 1, status: "generated" });
			expect(generateBuildVideo).not.toHaveBeenCalled();
			expect(persistence.succeedLeg).toHaveBeenCalledWith(
				BASE_ATTEMPT.id,
				1,
				expect.stringContaining("segments/segment-1.mp4"),
			);
		} finally {
			await rm(directory, { force: true, recursive: true });
		}
	});

	it("leaves unexpected processing failures generating for durable retry", async () => {
		const queued = {
			...BASE_ATTEMPT,
			startedAt: null,
			status: "queued" as const,
		};
		const fail = vi.fn();
		const refund = vi.fn();
		const settle = vi.fn();

		await expect(
			runVideoWorkflow(
				{
					attemptId: queued.id,
					projectId: queued.projectId,
					userId: queued.userId,
				},
				{
					dependencies: {
						claimQueued: vi.fn().mockResolvedValue(BASE_ATTEMPT),
						completedUnitsForAttempt: vi.fn().mockResolvedValue(1),
						execute: vi
							.fn()
							.mockRejectedValue(new Error("transient segment upload")),
						fail,
						loadAttempt: vi.fn().mockResolvedValue(queued),
						markSucceeded: vi.fn(),
						now: () => new Date(),
						recoverStoredVideo: vi.fn().mockResolvedValue(null),
						refund,
						reserve: vi.fn().mockResolvedValue({ ...RESERVATION, units: 1 }),
						settle,
						settleExisting: vi.fn(),
						unitsForAttempt: vi.fn().mockResolvedValue(1),
					},
					expectedKind: "video-extension",
					runId: "run_1",
				},
			),
		).rejects.toThrow("transient segment upload");
		expect(fail).not.toHaveBeenCalled();
		expect(refund).not.toHaveBeenCalled();
		expect(settle).not.toHaveBeenCalled();
	});

	it("settles provider evidence before making a partial failure visible", async () => {
		const queued = {
			...BASE_ATTEMPT,
			startedAt: null,
			status: "queued" as const,
		};
		const settle = vi.fn();
		const fail = vi.fn().mockResolvedValue(true);
		await runVideoWorkflow(
			{
				attemptId: queued.id,
				projectId: queued.projectId,
				userId: queued.userId,
			},
			{
				dependencies: {
					claimQueued: vi.fn().mockResolvedValue(BASE_ATTEMPT),
					completedUnitsForAttempt: vi.fn().mockResolvedValue(1),
					execute: vi.fn().mockResolvedValue({
						deliveredUnits: 1,
						reason: "provider_completed_delivery_failed",
						refundable: false,
						status: "failed",
					}),
					fail,
					loadAttempt: vi.fn().mockResolvedValue(queued),
					markSucceeded: vi.fn(),
					now: () => new Date(),
					recoverStoredVideo: vi.fn().mockResolvedValue(null),
					refund: vi.fn(),
					reserve: vi.fn().mockResolvedValue({ ...RESERVATION, units: 1 }),
					settle,
					settleExisting: vi.fn(),
					unitsForAttempt: vi.fn().mockResolvedValue(1),
				},
				expectedKind: "video-extension",
				runId: "run_1",
			},
		);

		expect(settle).toHaveBeenCalledWith(
			expect.objectContaining({ units: 1 }),
			1,
		);
		expect(settle.mock.invocationCallOrder[0]).toBeLessThan(
			fail.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
		);
	});

	it("delivers the silent joined video and succeeds the parent when TTS fails", async () => {
		const directory = await mkdtemp(join(tmpdir(), "video-extension-tts-"));
		const sourcePath = join(directory, "source.mp4");
		await writeFile(sourcePath, "source");
		const persistence = persistenceFor([
			leg({
				segmentKey: `sites/${BASE_ATTEMPT.projectId}/assets/${BASE_ATTEMPT.id}/segments/segment-1.mp4`,
				seq: 1,
				status: "succeeded",
			}),
		]);
		const attempt = {
			...BASE_ATTEMPT,
			voiceover: { language: "en" as const, script: "Keep moving forward." },
		};

		try {
			const execution = await executeExtension(
				attempt,
				sourcePath,
				PROBE,
				directory,
				{
					reservation: { ...RESERVATION, units: 1 },
					subject: { actorUserId: "user_1" },
				},
				{
					billing: billing(),
					persistence,
					speech: {
						synthesizeVoiceover: vi
							.fn()
							.mockRejectedValue(new Error("TTS down")),
					},
				} as never,
			);
			expect(execution).toMatchObject({
				deliveredUnits: 1,
				status: "generated",
				warning: expect.stringContaining("result is silent"),
			});
			expect(muxSoundtrack).not.toHaveBeenCalled();
			expect(persistence.persistVoiceoverDeliveryStatus).toHaveBeenCalledWith(
				attempt,
				"failed",
			);

			const markSucceeded = vi.fn().mockResolvedValue(true);
			const parentResult = await runVideoWorkflow(
				{
					attemptId: attempt.id,
					projectId: attempt.projectId,
					userId: attempt.userId,
				},
				{
					dependencies: {
						claimQueued: vi.fn(),
						completedUnitsForAttempt: vi.fn().mockResolvedValue(1),
						execute: vi.fn().mockResolvedValue(execution),
						fail: vi.fn(),
						loadAttempt: vi.fn().mockResolvedValue(attempt),
						markSucceeded,
						now: () => new Date("2026-08-21T00:05:00.000Z"),
						recoverStoredVideo: vi.fn().mockResolvedValue(null),
						refund: vi.fn(),
						reserve: vi.fn().mockResolvedValue({ ...RESERVATION, units: 1 }),
						settle: vi.fn(),
						settleExisting: vi.fn(),
						unitsForAttempt: vi.fn().mockResolvedValue(1),
					},
					expectedKind: "video-extension",
					runId: "run_1",
				},
			);
			expect(parentResult).toMatchObject({ status: "succeeded" });
			expect(markSucceeded).toHaveBeenCalledTimes(1);
			expect(
				persistence.persistVoiceoverDeliveryStatus.mock.invocationCallOrder[0],
			).toBeLessThan(
				markSucceeded.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
			);
		} finally {
			await rm(directory, { force: true, recursive: true });
		}
	});

	it("records delivered narration after a successful soundtrack mux", async () => {
		const directory = await mkdtemp(
			join(tmpdir(), "video-extension-voiceover-"),
		);
		const sourcePath = join(directory, "source.mp4");
		await writeFile(sourcePath, "source");
		const persistence = persistenceFor([
			leg({
				segmentKey: `sites/${BASE_ATTEMPT.projectId}/assets/${BASE_ATTEMPT.id}/segments/segment-1.mp4`,
				seq: 1,
				status: "succeeded",
			}),
		]);
		const attempt = {
			...BASE_ATTEMPT,
			voiceover: { language: "en" as const, script: "Keep moving forward." },
		};

		try {
			await expect(
				executeExtension(
					attempt,
					sourcePath,
					PROBE,
					directory,
					{
						reservation: { ...RESERVATION, units: 1 },
						subject: { actorUserId: "user_1" },
					},
					{
						billing: billing(),
						persistence,
						speech: {
							synthesizeVoiceover: vi.fn().mockResolvedValue({
								bytes: new Uint8Array([73, 68, 51]),
								mediaType: "audio/mpeg",
							}),
						},
					} as never,
				),
			).resolves.toMatchObject({ deliveredUnits: 1, status: "generated" });
			expect(muxSoundtrack).toHaveBeenCalledTimes(1);
			expect(persistence.persistVoiceoverDeliveryStatus).toHaveBeenCalledWith(
				attempt,
				"delivered",
			);
		} finally {
			await rm(directory, { force: true, recursive: true });
		}
	});

	it("checks only vid-1 final keys during parent recovery", async () => {
		vi.mocked(getObjectContentType)
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce("video/webm");
		const recovered = await createStoredFinalRecovery()({
			id: BASE_ATTEMPT.id,
			projectId: BASE_ATTEMPT.projectId,
		});

		expect(recovered).toMatchObject({ mediaType: "video/webm" });
		const keys = vi.mocked(getObjectContentType).mock.calls.map(([key]) => key);
		expect(keys).toEqual([
			`sites/${BASE_ATTEMPT.projectId}/assets/${BASE_ATTEMPT.id}/vid-1.mp4`,
			`sites/${BASE_ATTEMPT.projectId}/assets/${BASE_ATTEMPT.id}/vid-1.webm`,
		]);
		expect(
			keys.every(
				(key) => !key.includes("segments/") && !key.includes("frames/"),
			),
		).toBe(true);
	});

	it("rejects the worker-probed edit duration and refunds before calling the provider", async () => {
		vi.mocked(probeVideo).mockResolvedValueOnce({
			...PROBE,
			durationMs: 31_000,
		});
		const persistence = {
			persistSourceDuration: vi.fn().mockResolvedValue(true),
		};
		const editAttempt = {
			...BASE_ATTEMPT,
			kind: "video-edit" as const,
			model: "bytedance/seedance-2.5",
			status: "generating" as const,
		};
		const execution = await executeAttempt(
			editAttempt,
			{
				reservation: { ...RESERVATION, units: 1 },
				subject: { actorUserId: "user_1" },
			},
			{
				billing: billing(),
				persistence,
				speech: { synthesizeVoiceover: vi.fn() },
			} as never,
		);
		expect(execution).toMatchObject({
			deliveredUnits: 0,
			refundable: true,
			reason: "source_duration_invalid",
		});
		expect(editVideo).not.toHaveBeenCalled();

		const refund = vi.fn();
		const queuedEditAttempt = {
			...editAttempt,
			startedAt: null,
			status: "queued" as const,
		};
		await runVideoWorkflow(
			{
				attemptId: editAttempt.id,
				projectId: editAttempt.projectId,
				userId: editAttempt.userId,
			},
			{
				dependencies: {
					claimQueued: vi.fn().mockResolvedValue(editAttempt),
					completedUnitsForAttempt: vi.fn().mockResolvedValue(0),
					execute: vi.fn().mockResolvedValue(execution),
					fail: vi.fn().mockResolvedValue(true),
					loadAttempt: vi.fn().mockResolvedValue(queuedEditAttempt),
					markSucceeded: vi.fn(),
					now: () => new Date("2026-08-21T00:05:00.000Z"),
					recoverStoredVideo: vi.fn().mockResolvedValue(null),
					refund,
					reserve: vi.fn().mockResolvedValue({ ...RESERVATION, units: 1 }),
					settle: vi.fn(),
					settleExisting: vi.fn(),
					unitsForAttempt: vi.fn().mockResolvedValue(1),
				},
				expectedKind: "video-edit",
				runId: "run_1",
			},
		);
		expect(refund).toHaveBeenCalledWith(
			{ actorUserId: "user_1" },
			editAttempt.id,
			"video-edit",
		);
	});
});

function leg(input: {
	segmentKey?: string;
	seq: number;
	sourceFrameKey?: string;
	status: "queued" | "generating" | "succeeded" | "failed";
}) {
	return {
		attemptId: BASE_ATTEMPT.id,
		completedAt: input.status === "succeeded" ? new Date() : null,
		durationSeconds: 10 as const,
		error: null,
		id: `leg_${input.seq}`,
		model: "klingai/kling-v2.6-i2v",
		segmentKey: input.segmentKey ?? null,
		seq: input.seq,
		sourceFrameKey: input.sourceFrameKey ?? null,
		startedAt: input.status === "queued" ? null : new Date(),
		status: input.status,
	};
}

function persistenceFor(
	initialLegs: ReturnType<typeof leg>[],
	options: { providerEvidenceUnits?: number } = {},
) {
	const legs = initialLegs.map((item) => ({ ...item }));
	return {
		claimLeg: vi.fn(async (_attemptId: string, seq: number) => {
			const found = legs.find((item) => item.seq === seq);
			if (found?.status !== "queued") return null;
			found.status = "generating";
			found.startedAt = new Date();
			return { ...found };
		}),
		failLeg: vi.fn(),
		listLegs: vi.fn().mockResolvedValue(legs),
		persistActualDuration: vi.fn().mockResolvedValue(true),
		persistSourceDuration: vi.fn().mockResolvedValue(true),
		persistVoiceoverDeliveryStatus: vi.fn().mockResolvedValue(true),
		providerEvidenceUnits: vi
			.fn()
			.mockResolvedValue(options.providerEvidenceUnits ?? 0),
		recordLegFrame: vi.fn().mockResolvedValue(true),
		resetLegForRetry: vi.fn(
			async (
				_attemptId: string,
				seq: number,
				expectedSourceFrameKey: string | null,
			) => {
				const found = legs.find((item) => item.seq === seq);
				if (
					found?.status !== "generating" ||
					found.segmentKey !== null ||
					found.sourceFrameKey !== expectedSourceFrameKey
				) {
					return false;
				}
				found.sourceFrameKey = null;
				found.startedAt = null;
				found.status = "queued";
				return true;
			},
		),
		succeedLeg: vi.fn(async (_attemptId: string, seq: number, key: string) => {
			const found = legs.find((item) => item.seq === seq);
			if (!found) return false;
			found.status = "succeeded";
			found.segmentKey = key;
			return true;
		}),
	};
}

function billing() {
	return {
		capture: vi.fn(),
	};
}
