// The pace rule of the board: is a rep or a territory ahead of, on, or behind the pace of its target?
// The reps list, the rep page, and the targets page read it. The badge and the attainment bar show the result.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every pace status, best first. Labels: `pace.<status>`. */
export const PACE_STATUSES = ["ahead", "on_pace", "behind"] as const;

/** One pace status. */
export type PaceStatus = (typeof PACE_STATUSES)[number];

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Badge variant per pace status. */
export const PACE_BADGE = {
	ahead: "success",
	on_pace: "info",
	behind: "warning",
} satisfies Record<PaceStatus, BadgeVariant>;

/** Text color per pace status, for an attainment figure. The pace word always shows beside it. */
export const PACE_TEXT = {
	ahead: "text-success",
	on_pace: "text-info",
	behind: "text-warning",
} satisfies Record<PaceStatus, string>;

// 5 % over the expected share is ahead. Under 90 % of it is behind: most teams close late in the quarter.
const AHEAD_RATIO = 1.05;
const BEHIND_RATIO = 0.9;

/**
 * The pace status of `attainment` (booked / target) when a linear pace expects `pace` (0 to 1).
 * On the first day of a period the pace is 0, so every rep is on pace.
 * A closed period (pace 1) has no "on pace": its target is met (ahead) or missed (behind).
 */
export function paceStatusOf(attainment: number, pace: number): PaceStatus {
	if (pace === 0) {
		return "on_pace";
	}
	if (pace >= 1) {
		return attainment >= 1 ? "ahead" : "behind";
	}
	const ratio = attainment / pace;
	if (ratio >= AHEAD_RATIO) {
		return "ahead";
	}
	return ratio < BEHIND_RATIO ? "behind" : "on_pace";
}

/** booked / target, or 0 when the target is 0. A target of 0 has nothing to attain. */
export function attainmentOf(booked: number, target: number): number {
	return target > 0 ? booked / target : 0;
}
