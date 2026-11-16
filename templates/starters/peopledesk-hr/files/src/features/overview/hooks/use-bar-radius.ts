// The corner of a chart bar in px, from the radius of the live theme.
// The two bar charts of the digest call it. recharts takes a number, not a CSS variable.
import { type AppThemeFile, useAppTheme } from "~/styles/theme";

// Bar corner in px for each radius of the theme. A wider corner would round a thin bar into a pill.
const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

/** The bar corner of the current theme. The builder can change the radius with no turn, so it reads the live theme. */
export function useBarRadius(): number {
	return BAR_RADIUS_PX[useAppTheme().selection.radius];
}
