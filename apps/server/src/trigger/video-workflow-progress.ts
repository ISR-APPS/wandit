import { metadata } from "@trigger.dev/sdk";
import type { VideoBuildProgress } from "@wandit/contracts";
import { videoBuildProgressSchema } from "@wandit/contracts";

import type { VideoWorkflowProgress } from "../modules/media-generations/application/services/video-edit-extension-runner";

const HEARTBEAT_INTERVAL_MS = 5_000;

export type VideoWorkflowProgressTracker = VideoWorkflowProgress & {
	finish: (warning?: string) => void;
	stop: () => void;
};

export function createVideoWorkflowProgressTracker(input: {
	durationSeconds?: number;
	headline: string;
}): VideoWorkflowProgressTracker {
	const prior = videoBuildProgressSchema.safeParse(metadata.get("progress"));
	const snapshot: VideoBuildProgress =
		prior.success && !prior.data.done
			? { ...prior.data }
			: {
					aspect: "16:9",
					done: false,
					durationSeconds: input.durationSeconds ?? 10,
					elapsedMs: 0,
					headline: input.headline,
					percent: 4,
					phase: "starting",
					stage: "starting",
				};
	const startedAt = Date.now();
	let stageCeiling = 10;

	const publish = (percent: number): void => {
		try {
			snapshot.elapsedMs = Date.now() - startedAt;
			snapshot.percent = snapshot.done
				? 100
				: Math.min(97, Math.max(snapshot.percent, percent));
			metadata.set("progress", { ...snapshot });
		} catch {
			// Realtime metadata is best-effort and never controls execution.
		}
	};

	const heartbeat = setInterval(() => {
		publish(Math.min(stageCeiling, snapshot.percent + 0.5));
	}, HEARTBEAT_INTERVAL_MS);
	publish(4);

	return {
		describe: (attempt) => {
			snapshot.aspect = attempt.aspect;
			snapshot.durationSeconds = attempt.durationSeconds;
			snapshot.promptExcerpt = attempt.prompt.slice(0, 400);
			if (attempt.voiceover) {
				snapshot.voiceoverLanguage = attempt.voiceover.language;
			}
			publish(8);
		},
		finish: (warning) => {
			clearInterval(heartbeat);
			snapshot.done = true;
			snapshot.headline = warning ?? "Video ready.";
			snapshot.phase = "finishing";
			snapshot.stage = "finishing";
			publish(100);
		},
		report: (update) => {
			snapshot.headline = update.headline;
			snapshot.stage = update.stage;
			snapshot.phase = phaseForStage(update.stage);
			stageCeiling = Math.min(97, Math.max(update.percent + 8, stageCeiling));
			publish(update.percent);
		},
		stop: () => clearInterval(heartbeat),
	};
}

function phaseForStage(
	stage: NonNullable<VideoBuildProgress["stage"]>,
): VideoBuildProgress["phase"] {
	if (stage === "publishing") {
		return "publishing";
	}
	if (stage === "finishing") {
		return "finishing";
	}
	if (stage === "starting") {
		return "starting";
	}
	return "rendering";
}
