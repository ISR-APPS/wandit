// The timeline of the ritual showpiece: one pure function from scroll progress to the state of the stage.
// useRitualScrub calls it on each animation frame and writes the result into CSS variables of the section.
// The timeline has 4.4 units. Two short exchanges sit in long settled holds, so each photo rests on screen.

/** The visible state of the ritual section. Each value is 0 to 1. */
export type RitualFrame = {
	/** How much of the vertical hairline is drawn. */
	line: number;
	/** Opacity of the white steam over the stage, 0.07 at rest and 0.5 at the peak of an exchange. */
	steam: number;
	/** Opacity of the top photo, the steam room (stage 01). */
	steamRoom: number;
	/** Opacity of the middle photo, the cold pool (stage 02). The tea tray under it never fades. */
	coldPool: number;
	/** How "active" each of the three stages is: 1 gives full text and the sage ring, 0 gives a dim step. */
	stages: readonly [number, number, number];
};

/** Length of the timeline in units. The hairline draws over the first 4 units, then a hold of 0.4. */
const TIMELINE_UNITS = 4.4;

/** Start of each exchange, in timeline units. The second starts 1.6 units after the first. */
const EXCHANGE_STARTS = [1.32, 2.92] as const;

/** Resting and peak opacity of the stage steam. The photo changes while the steam is high. */
const STEAM_REST = 0.07;
const STEAM_PEAK = 0.5;

/** A sine ease in and out on 0 to 1: the "tide breath" of the world. Nothing overshoots. */
function easeSine(value: number): number {
	return (1 - Math.cos(Math.PI * value)) / 2;
}

/** The eased share of a ramp that starts at `start` and lasts `duration` units, at time `time`. */
function ramp(time: number, start: number, duration: number): number {
	return easeSine(Math.min(1, Math.max(0, (time - start) / duration)));
}

/** The frame at `progress` (0 at the start of the scrub, 1 at its end). Values outside 0 to 1 are clamped. */
export function ritualFrameAt(progress: number): RitualFrame {
	const time = Math.min(1, Math.max(0, progress)) * TIMELINE_UNITS;
	const [first, second] = EXCHANGE_STARTS;
	// Each exchange: the steam rises in 0.34, the photo fades in 0.26 under it, then the steam settles in 0.46.
	const swell = (start: number) =>
		ramp(time, start, 0.34) - ramp(time, start + 0.38, 0.46);
	return {
		line: Math.min(1, time / 4),
		steam:
			STEAM_REST + (STEAM_PEAK - STEAM_REST) * (swell(first) + swell(second)),
		steamRoom: 1 - ramp(time, first + 0.14, 0.26),
		coldPool: 1 - ramp(time, second + 0.14, 0.26),
		stages: [
			1 - ramp(time, first + 0.08, 0.34),
			ramp(time, first + 0.14, 0.34) - ramp(time, second + 0.08, 0.34),
			ramp(time, second + 0.14, 0.34),
		],
	};
}
