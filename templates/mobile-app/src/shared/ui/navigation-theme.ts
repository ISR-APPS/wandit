/**
 * The navigation theme: the colors and fonts of the stack headers, the tab bar, and the
 * screen background behind a transition. The root layout passes it to
 * ThemeProvider. It reads the variables of src/global.css, so it follows dark mode.
 */
import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useCSSVariable, useUniwind } from "uniwind";

type FontStyle = Theme["fonts"]["regular"];

/**
 * The font style of one `--font-*` token, or the base style when the token is missing.
 * The family file holds the weight, so the style keeps `fontWeight: "normal"`.
 * Android drops a loaded family when a weight is also set.
 */
function fontOf(
	token: string | number | undefined,
	base: FontStyle,
): FontStyle {
	if (typeof token !== "string" || token === "") {
		return base;
	}
	// On the web the value keeps its CSS quotes; a fontFamily style needs the bare name.
	return { fontFamily: token.replaceAll('"', ""), fontWeight: "normal" };
}

/** The theme for ThemeProvider. The accent marks the active tab and the header buttons. */
export function useNavigationTheme(): Theme {
	const { theme } = useUniwind();
	const [accent, background, foreground, separator, danger] = useThemeColor([
		"accent",
		"background",
		"foreground",
		"separator",
		"danger",
	]);
	const [normal, medium, semibold, bold] = useCSSVariable([
		"--font-normal",
		"--font-medium",
		"--font-semibold",
		"--font-bold",
	]);
	const base = theme === "dark" ? DarkTheme : DefaultTheme;
	return {
		...base,
		colors: {
			primary: accent,
			background,
			// The header and the tab bar use the page color, so they read as one surface.
			card: background,
			text: foreground,
			border: separator,
			notification: danger,
		},
		// Tab labels use `medium`. Header titles use `bold` on iOS and `medium` on
		// Android and the web. The iOS large title uses `heavy`.
		fonts: {
			regular: fontOf(normal, base.fonts.regular),
			medium: fontOf(medium, base.fonts.medium),
			bold: fontOf(semibold, base.fonts.bold),
			heavy: fontOf(bold, base.fonts.heavy),
		},
	};
}
