// Shapes of the chart data, the period choices, and the one change formula of the app.
// The query files build the series. The chart cards take the types.

/** The period choices of a trend panel, in days. The price history covers two periods of the longest one. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One period choice. */
export type PeriodDays = (typeof PERIOD_DAYS)[number];

/** The period of the home figures and of the first trend view, in days. */
export const DEFAULT_DAYS = 30 satisfies PeriodDays;

/** Reads a period from a control value. An unknown text gives the default period. */
export function parsePeriodDays(value: string): PeriodDays {
	return PERIOD_DAYS.find((days) => String(days) === value) ?? DEFAULT_DAYS;
}

/** Change against an earlier value, as a ratio: 0.12 is +12 %. null when the earlier value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}

/** The ticks of a chart axis: round values that cover a range, and the distance between two of them. */
export type AxisTicks = { ticks: number[]; step: number };

/**
 * Round axis values that cover `min` to `max`, about 5 of them: 160K, 170K, 180K, not 161K, 173K, 184K.
 * The first tick is at or under `min`, the last one at or over `max`. A chart uses them as its ticks and its domain.
 */
export function niceTicks(min: number, max: number): AxisTicks {
	// A flat series still needs a range: 1 % around its value.
	const low = max > min ? min : min * 0.99;
	const high = max > min ? max : max * 1.01;
	const rawStep = (high - low) / 4;
	if (!(rawStep > 0)) {
		return { ticks: [min], step: 1 };
	}
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	// The step is 1, 2, 2.5, or 5 times a power of 10.
	// The tolerance stops a float rest (0.0025000000000000005) from skipping a step that fits exactly.
	const step =
		[1, 2, 2.5, 5]
			.map((factor) => factor * magnitude)
			.find((candidate) => candidate >= rawStep * (1 - 1e-9)) ?? 10 * magnitude;
	const ticks: number[] = [];
	const first = Math.floor(low / step);
	const last = Math.ceil(high / step);
	for (let index = first; index <= last; index += 1) {
		// 12 digits remove the float rest of the product.
		ticks.push(Number((index * step).toPrecision(12)));
	}
	return { ticks, step };
}
