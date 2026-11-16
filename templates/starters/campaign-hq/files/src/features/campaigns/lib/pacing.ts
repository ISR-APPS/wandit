// The pace of a live campaign: its spend against the share of the budget that the days so far allow.
// campaigns.queries.ts computes it. The campaign table and the pacing panel show it with PACING_BADGE.
import type { BadgeVariant } from "~/features/marketing";

/** Every pace, from slow to fast. The label is the message key `pacing.<state>`. */
export const PACING_STATES = ["behind", "on_track", "ahead"] as const;

/** One pace. */
export type PacingState = (typeof PACING_STATES)[number];

/** The pace of a live campaign. */
export type Pacing = {
	state: PacingState;
	/** Spend divided by the planned spend of the days so far: 1.08 spends 8 % faster than the plan. */
	ratio: number;
	/** The spend at the end of the flight at the current daily rate, in whole units of CURRENCY. */
	projectedSpend: number;
};

/** Badge variant per pace. A fast campaign uses its budget before the end, so it is the warning. */
export const PACING_BADGE = {
	behind: "info",
	on_track: "success",
	ahead: "warning",
} satisfies Record<PacingState, BadgeVariant>;

// A pace inside this band is on track. Media buyers act at about 6 % fast or 12 % slow.
const AHEAD_FROM = 1.06;
const BEHIND_UNDER = 0.88;

/** The pace of a campaign that ran `elapsedDays` of `flightDays`. null on its first day: no full day yet. */
export function pacingOf(
	spend: number,
	budget: number,
	elapsedDays: number,
	flightDays: number,
): Pacing | null {
	if (elapsedDays === 0 || budget === 0) {
		return null;
	}
	const ratio = spend / ((budget * elapsedDays) / flightDays);
	return {
		state:
			ratio >= AHEAD_FROM
				? "ahead"
				: ratio < BEHIND_UNDER
					? "behind"
					: "on_track",
		ratio,
		projectedSpend: (spend / elapsedDays) * flightDays,
	};
}
