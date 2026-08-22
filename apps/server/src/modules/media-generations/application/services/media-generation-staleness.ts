import type { MediaGenerationKind } from "@wandit/contracts";

export const MEDIA_GENERATION_STALE_QUEUED_MS = 30 * 60_000;

export const MEDIA_GENERATION_STALE_GENERATING_MS = {
	"image-animation": 15 * 60_000,
	"text-to-video": 15 * 60_000,
	"video-edit": 20 * 60_000,
	"video-extension": 35 * 60_000,
} as const satisfies Record<MediaGenerationKind, number>;

export type MediaGenerationGeneratingCutoffs = Record<
	MediaGenerationKind,
	Date
>;

export type MediaGenerationActivity = {
	kind: MediaGenerationKind;
	latestLegActivityAt: Date | null;
	startedAt: Date | null;
};

export function isLegActivityTrackedGeneration(
	kind: MediaGenerationKind,
): kind is "video-edit" | "video-extension" {
	return kind === "video-edit" || kind === "video-extension";
}

export function mediaGenerationLastActivityAt(
	activity: MediaGenerationActivity,
): Date | null {
	if (activity.startedAt === null || activity.latestLegActivityAt === null) {
		return activity.startedAt;
	}

	return activity.latestLegActivityAt > activity.startedAt
		? activity.latestLegActivityAt
		: activity.startedAt;
}

export function isMediaGenerationGeneratingStale(
	activity: MediaGenerationActivity,
	now: Date,
): boolean {
	const lastActivityAt = mediaGenerationLastActivityAt(activity);

	return (
		lastActivityAt !== null &&
		lastActivityAt <
			new Date(
				now.getTime() - MEDIA_GENERATION_STALE_GENERATING_MS[activity.kind],
			)
	);
}

export function mediaGenerationGeneratingCutoffs(
	now: Date,
): MediaGenerationGeneratingCutoffs {
	return {
		"image-animation": new Date(
			now.getTime() - MEDIA_GENERATION_STALE_GENERATING_MS["image-animation"],
		),
		"text-to-video": new Date(
			now.getTime() - MEDIA_GENERATION_STALE_GENERATING_MS["text-to-video"],
		),
		"video-edit": new Date(
			now.getTime() - MEDIA_GENERATION_STALE_GENERATING_MS["video-edit"],
		),
		"video-extension": new Date(
			now.getTime() - MEDIA_GENERATION_STALE_GENERATING_MS["video-extension"],
		),
	};
}
