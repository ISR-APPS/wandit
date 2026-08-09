import type { ButtonSize } from "heroui-native";

// Wandit ember brand constants for JS-side consumers (react-native-svg,
// boxShadow strings). These must stay plain hex/rgba — RN's color parser does
// not understand oklch(). CSS-side tokens live in global.css; keep both in
// sync with the design tokens in packages/ui/src/styles/globals.css:
//   ember-1 light oklch(0.80 0.15 70) -> #FAAB3F   dark oklch(0.84 0.14 75) -> #FFBC56
//   ember-2 light oklch(0.66 0.19 35) -> #EF5B36   dark oklch(0.70 0.19 38) -> #FD6A3A

export type BrandGradientStops = readonly [string, string];

/** Ember gradient stops (light -> base, rendered as a 135deg ramp). */
export const BRAND_GRADIENT_LIGHT: BrandGradientStops = ["#FAAB3F", "#EF5B36"];
export const BRAND_GRADIENT_DARK: BrandGradientStops = ["#FFBC56", "#FD6A3A"];

/** Theme-agnostic fallback (dark stops) for callers without theme context. */
export const BRAND_GRADIENT: BrandGradientStops = BRAND_GRADIENT_DARK;

/** Corner radii used by AppButton's gradient fill, one per ButtonSize. */
export const BRAND_BUTTON_RADIUS: Record<ButtonSize, number> = {
	sm: 14,
	md: 16,
	lg: 20,
};

/** Ember glow shadows behind primary CTAs, one per ButtonSize. */
export const BRAND_GLOW: Record<ButtonSize, string> = {
	sm: "0 4px 14px -4px rgba(253, 106, 58, 0.6)",
	md: "0 4px 16px -4px rgba(253, 106, 58, 0.6)",
	lg: "0 8px 28px -8px rgba(253, 106, 58, 0.45)",
};

// Icon stroke tones from the prototypes (not part of HeroUI's THEME_COLORS,
// so they can't come from useThemeColor). Pick with useAppTheme().isDark.
//   stroke light oklch(0.4 0.015 58)  dark oklch(0.85 0.01 75)
//   faint  light oklch(0.68 0.012 60) dark oklch(0.55 0.012 65)
export const ICON_STROKE = { light: "#4E4640", dark: "#D2CDC7" } as const;
export const ICON_FAINT = { light: "#9E9791", dark: "#77706A" } as const;
