export const THEMES = [
	{
		name: "Wandit",
		value: "wandit",
		colors: ["#fcfbf8", "oklch(0.62 0.16 45)"],
	},
	{
		name: "Default",
		value: "default",
		colors: ["oklch(0.33 0 0)"],
	},
	{
		name: "Underground",
		value: "underground",
		colors: ["oklch(0.5315 0.0694 156.19)"],
	},
	{
		name: "Rose Garden",
		value: "rose-garden",
		colors: ["oklch(0.5827 0.2418 12.23)"],
	},
	{
		name: "Lake View",
		value: "lake-view",
		colors: ["oklch(0.765 0.177 163.22)"],
	},
	{
		name: "Sunset Glow",
		value: "sunset-glow",
		colors: ["oklch(0.5827 0.2187 36.98)"],
	},
	{
		name: "Forest Whisper",
		value: "forest-whisper",
		colors: ["oklch(0.5276 0.1072 182.22)"],
	},
	{
		name: "Ocean Breeze",
		value: "ocean-breeze",
		colors: ["oklch(0.59 0.20 277.12)"],
	},
	{
		name: "Lavender Dream",
		value: "lavender-dream",
		colors: ["oklch(0.71 0.16 293.54)"],
	},
] as const;

export type ThemePreset = (typeof THEMES)[number]["value"];
export type ThemeRadius = "default" | "none" | "sm" | "md" | "lg" | "xl";
export type ThemeScale = "none" | "sm" | "lg";
export type ContentLayout = "full" | "centered";

export type ThemeConfig = {
	preset: ThemePreset;
	radius: ThemeRadius;
	scale: ThemeScale;
	contentLayout: ContentLayout;
};

export const DEFAULT_THEME: ThemeConfig = {
	preset: "wandit",
	radius: "default",
	scale: "none",
	contentLayout: "full",
};

export const THEME_CONFIG_STORAGE_KEY = "wandit-admin-theme-config";

const radii: ThemeRadius[] = ["default", "none", "sm", "md", "lg", "xl"];
const scales: ThemeScale[] = ["none", "sm", "lg"];
const contentLayouts: ContentLayout[] = ["full", "centered"];

function isThemePreset(value: unknown): value is ThemePreset {
	return THEMES.some((theme) => theme.value === value);
}

export function readThemeConfig(): ThemeConfig {
	try {
		const value = window.localStorage.getItem(THEME_CONFIG_STORAGE_KEY);
		if (!value) {
			return DEFAULT_THEME;
		}

		const candidate = JSON.parse(value) as Partial<ThemeConfig>;
		const preset = isThemePreset(candidate.preset)
			? candidate.preset
			: DEFAULT_THEME.preset;

		return {
			preset,
			radius: radii.includes(candidate.radius as ThemeRadius)
				? (candidate.radius as ThemeRadius)
				: DEFAULT_THEME.radius,
			scale: scales.includes(candidate.scale as ThemeScale)
				? (candidate.scale as ThemeScale)
				: DEFAULT_THEME.scale,
			contentLayout: contentLayouts.includes(
				candidate.contentLayout as ContentLayout,
			)
				? (candidate.contentLayout as ContentLayout)
				: DEFAULT_THEME.contentLayout,
		};
	} catch {
		return DEFAULT_THEME;
	}
}

export function applyThemeConfig(theme: ThemeConfig) {
	const body = document.body;

	if (theme.preset === "default") {
		body.removeAttribute("data-theme-preset");
	} else {
		body.setAttribute("data-theme-preset", theme.preset);
	}

	if (theme.radius === "default") {
		body.removeAttribute("data-theme-radius");
	} else {
		body.setAttribute("data-theme-radius", theme.radius);
	}

	if (theme.scale === "none") {
		body.removeAttribute("data-theme-scale");
	} else {
		body.setAttribute("data-theme-scale", theme.scale);
	}

	body.setAttribute("data-theme-content-layout", theme.contentLayout);
}
