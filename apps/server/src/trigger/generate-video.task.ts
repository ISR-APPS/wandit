// FIRST import on purpose: raises process-wide fetch idle timeouts before the
// AI/storage SDK can issue a long-running text-to-video request.
import "./undici-timeouts";

import { logger, metadata, schemaTask } from "@trigger.dev/sdk";
import type { VideoBuildProgress } from "@wandit/contracts";
import { videoBuildProgressSchema } from "@wandit/contracts";
import { createDb } from "@wandit/db";

import { EXPECTED_VIDEO_RENDER_MS } from "../modules/ai-chat/agent/site-builder/generate-video";
import type {
	ImageAnimationAttempt,
	ImageAnimationRunnerDependencies,
} from "../modules/media-generations/application/services/image-animation-runner";
import {
	parseImageAnimationPayload,
	runImageAnimation,
} from "../modules/media-generations/application/services/image-animation-runner";
import { createImageAnimationRuntime } from "./image-animation.runtime";
import { triggerAnalytics } from "./init";
import { videoGenerationQueue } from "./video-generation.queue";

const HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * The text-to-video execution entrypoint. Shares the durable state machine
 * (runImageAnimation) and runtime adapter with animate-image — the attempt
 * row's `kind` column routes the provider call — and adds the staged
 * "progress" metadata the chat card streams over Trigger Realtime.
 *
 * Trigger retries are intentionally generous, but the database claim remains
 * the provider-call authority. Once a row is generating, retries only recover
 * its deterministic R2 output or settle/refund it.
 */
export const generateVideoTask = schemaTask({
	id: "generate-video",
	maxDuration: 480,
	queue: videoGenerationQueue,
	retry: {
		factor: 2,
		maxAttempts: 12,
		maxTimeoutInMs: 60_000,
		minTimeoutInMs: 5_000,
		randomize: true,
	},
	schema: parseImageAnimationPayload,
	// The API's stale queued guard closes rows at 30 minutes. Expire the
	// Trigger delivery first; the scheduled reconciler will persist/refund it.
	ttl: "25m",
	run: async (payload, { ctx, signal }) => {
		const db = createDb();
		const progress = createVideoProgressTracker();

		try {
			metadata
				.set("attemptId", payload.attemptId)
				.set("projectId", payload.projectId)
				.set("stage", "settling");

			const runtime = createImageAnimationRuntime(db, triggerAnalytics);
			const result = await runImageAnimation(payload, {
				dependencies: withProgress(runtime.runner, progress),
				runId: ctx.run.id,
				signal,
			});

			if (result.status === "succeeded") {
				progress.finish();
			}

			metadata.set("stage", result.status);
			logger.info(`Video generation ${payload.attemptId} ${result.status}`, {
				reason: result.status === "failed" ? result.reason : undefined,
				recovered: result.status === "succeeded" ? result.recovered : undefined,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			progress.stop();
			await db.$client.end();
		}
	},
});

type VideoProgressTracker = {
	beginRendering: (attempt: ImageAnimationAttempt) => void;
	beginPublishing: () => void;
	describe: (attempt: ImageAnimationAttempt) => void;
	finish: () => void;
	stop: () => void;
};

/**
 * Same discipline as the page build's tracker: one mutable snapshot,
 * monotonic percent capped at 97 until done, published once at construction
 * so the card lights up before the first slow step, and every publish
 * swallows its own errors — progress must never break the render.
 *
 * Run metadata survives Trigger retries while this snapshot does not, so the
 * tracker seeds from the run's already-published snapshot: attempt 2 of a
 * crashed render republishes the high-water mark instead of rewinding the
 * card to 4%.
 */
function createVideoProgressTracker(): VideoProgressTracker {
	const prior = videoBuildProgressSchema.safeParse(metadata.get("progress"));
	const snapshot: VideoBuildProgress =
		prior.success && !prior.data.done
			? { ...prior.data }
			: {
					aspect: "16:9",
					done: false,
					durationSeconds: 10,
					elapsedMs: 0,
					headline: "Reading the director's cut…",
					percent: 4,
					phase: "starting",
				};
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let renderStartedAt: number | null = null;
	let expectedRenderMs = expectedRenderTime(snapshot.durationSeconds);

	const publish = (estimate: number): void => {
		try {
			snapshot.percent = snapshot.done
				? 100
				: Math.min(97, Math.max(estimate, snapshot.percent));
			metadata.set("progress", { ...snapshot });
		} catch {
			// Progress is best-effort — never let it break the render.
		}
	};

	const stopHeartbeat = (): void => {
		if (heartbeat) {
			clearInterval(heartbeat);
			heartbeat = null;
		}
	};

	// Republishes the carried-forward percent on a retry (Math.max keeps it).
	publish(4);

	return {
		describe: (attempt) => {
			snapshot.aspect = attempt.aspect;
			snapshot.durationSeconds = attempt.durationSeconds;
			snapshot.promptExcerpt = attempt.prompt.slice(0, 400);
			expectedRenderMs = expectedRenderTime(attempt.durationSeconds);
			publish(8);
		},
		beginRendering: (attempt) => {
			snapshot.phase = "rendering";
			snapshot.headline = `Rendering the ${attempt.durationSeconds}-second clip…`;
			renderStartedAt = Date.now();
			publish(15);
			stopHeartbeat();
			// The provider call is one opaque multi-minute request; the heartbeat
			// keeps the card's clock and bar alive while it runs.
			heartbeat = setInterval(() => {
				if (renderStartedAt === null) {
					return;
				}
				const elapsed = Date.now() - renderStartedAt;
				snapshot.elapsedMs = elapsed;
				publish(15 + Math.min(1, elapsed / expectedRenderMs) * 75);
			}, HEARTBEAT_INTERVAL_MS);
		},
		beginPublishing: () => {
			stopHeartbeat();
			if (renderStartedAt !== null) {
				snapshot.elapsedMs = Date.now() - renderStartedAt;
			}
			snapshot.phase = "publishing";
			snapshot.headline = "Publishing the finished video…";
			publish(94);
		},
		finish: () => {
			stopHeartbeat();
			snapshot.phase = "finishing";
			snapshot.headline = "Video ready.";
			snapshot.done = true;
			publish(100);
		},
		stop: stopHeartbeat,
	};
}

function expectedRenderTime(durationSeconds: number): number {
	if (durationSeconds === 5 || durationSeconds === 15) {
		return EXPECTED_VIDEO_RENDER_MS[durationSeconds];
	}

	return EXPECTED_VIDEO_RENDER_MS[10];
}

/**
 * Wraps the shared runner dependencies with progress emissions at each
 * lifecycle edge. The wrapped functions stay byte-for-byte the originals —
 * progress observes, never decides.
 */
function withProgress(
	runner: ImageAnimationRunnerDependencies,
	progress: VideoProgressTracker,
): ImageAnimationRunnerDependencies {
	return {
		...runner,
		claimQueued: async (attempt, input) => {
			progress.describe(attempt);
			const claimed = await runner.claimQueued(attempt, input);
			if (claimed) {
				progress.beginRendering(claimed);
			}
			return claimed;
		},
		markSucceeded: async (attempt, video, completedAt, actorUserId) => {
			progress.beginPublishing();
			return runner.markSucceeded(attempt, video, completedAt, actorUserId);
		},
	};
}
