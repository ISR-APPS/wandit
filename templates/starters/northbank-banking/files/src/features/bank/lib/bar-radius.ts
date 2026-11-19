// The bar corner of the bar charts, in px, for each radius of the theme.
// The bar charts of the home read it with useAppTheme(), so a radius change in the builder reaches the bars.
import type { AppThemeFile } from "~/styles/theme";

/** recharts takes a number, not a CSS variable. 2 px keeps a soft corner on small bars; 4 px matches lg and xl. */
export const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;
