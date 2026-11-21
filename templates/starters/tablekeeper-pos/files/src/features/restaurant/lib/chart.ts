// Chart constants that every bar chart of the app shares: the bar corner per theme radius.
// The sales home and the day report read it from ~/features/restaurant.
import type { AppThemeFile } from "~/styles/theme";

/** Bar corner in px for each radius of the theme. recharts takes a number, not a CSS variable. */
export const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 3,
	lg: 4,
	xl: 5,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;
