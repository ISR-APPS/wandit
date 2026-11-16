// The color steps of the heat calendar and the step of one cell.
// HeatCalendar, HeatStrip, and the legend of OrdersHeatPanel read them.
// The only hue is --chart-1, so a theme change also changes the scale.

/** The 5 steps from `--muted` (no check) to `--chart-1` (the busiest day). The legend shows the same 5. */
export const HEAT_STEPS = [
	"bg-muted",
	"bg-[color-mix(in_oklch,var(--chart-1)_25%,var(--muted))]",
	"bg-[color-mix(in_oklch,var(--chart-1)_50%,var(--muted))]",
	"bg-[color-mix(in_oklch,var(--chart-1)_75%,var(--muted))]",
	"bg-chart-1",
] as const;

/**
 * Step of one cell: 0 to 4, an index of HEAT_STEPS. value / max is a share from 0 to 1.
 * Any check gives step 1 or more, so a quiet day never looks empty. A max of 0 gives step 0.
 */
export function heatStep(value: number, max: number): number {
	return value <= 0 || max <= 0
		? 0
		: Math.min(
				HEAT_STEPS.length - 1,
				Math.ceil((value / max) * (HEAT_STEPS.length - 1)),
			);
}
