// The bar styles that the two bar charts of the home share: the corner per theme radius, and the fill of today.
// The lesson chart and the enrollment strip read them. recharts takes numbers, not CSS variables.
import type { AppThemeFile } from "~/styles/theme";

/** Bar corner in px. The user can change the radius in the builder with no turn, so never write a fixed number. */
export const BAR_RADIUS_PX = {
	none: 0,
	sm: 2,
	md: 2,
	lg: 4,
	xl: 4,
} satisfies Record<AppThemeFile["selection"]["radius"], number>;

/** 0.35. Today is not over, so its bar is lighter: a short bar then does not read as a sudden drop. */
export const TODAY_FILL_OPACITY = 0.35;
