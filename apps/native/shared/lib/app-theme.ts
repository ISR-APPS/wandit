// Theme-name helpers for the shared UI kit's theme context. The app currently
// ships two Uniwind themes ("light"/"dark"); named theme variants would follow
// the "<id>-light"/"<id>-dark" convention if they are ever registered in
// metro.config.js (withUniwindConfig extraThemes).
export type ThemeName = "light" | "dark" | (string & {});

/** "brand-dark" -> "brand"; bare "light"/"dark" -> "default". */
export function getThemeIdFromName(themeName: string): string {
	const match = /^(.+)-(light|dark)$/.exec(themeName);
	return match ? match[1] : "default";
}

/** A theme is light unless its name is "dark" or ends in "-dark". */
export function isLightTheme(themeName: string): boolean {
	return themeName !== "dark" && !themeName.endsWith("-dark");
}
