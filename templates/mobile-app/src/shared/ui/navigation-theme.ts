/**
 * The navigation theme: the colors of the stack headers, the tab bar, and the
 * screen background behind a transition. The root layout passes it to
 * ThemeProvider. It reads the variables of src/global.css, so it follows dark mode.
 */
import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useUniwind } from "uniwind";

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
	};
}
