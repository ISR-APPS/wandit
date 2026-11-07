import {
	APP_THEME_TEMPLATE_SELECTION,
	type AppThemeDesign,
	type AppThemeSelection,
} from "@wandit/contracts/v2/app-theme";
import { describe, expect, it } from "vitest";

import { designedThemeName, designedThemeSelection } from "./app-theme-design";

describe("designedThemeName", () => {
	it.each([
		// A line break in the commit message "Theme: <name>" could add a fake git trailer.
		["Bleu\nnuit", "Bleu nuit"],
		["<b>Zen</b>; {x}", "b Zen /b x"],
		[" \u0007<>{};\t", "AI theme"],
		["a".repeat(60), "a".repeat(40)],
		// 20 moons are 40 code units. A 21st would pass the limit, so no half emoji stays.
		["🌙".repeat(25), "🌙".repeat(20)],
	])("turns %j into %j", (raw, expected) => {
		expect(designedThemeName(raw)).toBe(expected);
	});
});

describe("designedThemeSelection", () => {
	it("keeps the structure axes of the user, lowers the seeds, and applies the coherence rules", () => {
		const current: AppThemeSelection = {
			...APP_THEME_TEMPLATE_SELECTION,
			scale: "lg",
			content: "centered",
			sidebarCollapse: "rail",
			sidebarStart: "collapsed",
			userMenu: "sidebar-header",
		};
		const design: AppThemeDesign = {
			name: "Menthe douce",
			mode: "light",
			background: "#FAFAF7",
			foreground: "#1C1A17",
			primary: "#1F6098",
			font: "geist",
			displayFont: "fraunces",
			radius: "lg",
			border: "0.5",
			shadow: "sm",
			shadowStyle: "hard",
			sidebarStyle: "floating",
			sidebarTone: "brand",
			activeItem: "pill",
			header: "plain",
			frame: "outlined",
			icons: "bold",
			navIcon: "color",
		};

		expect(designedThemeSelection(design, current)).toEqual({
			source: {
				kind: "seeds",
				background: "#fafaf7",
				foreground: "#1c1a17",
				primary: "#1f6098",
			},
			mode: "light",
			primary: "look",
			font: "geist",
			displayFont: "fraunces",
			radius: "lg",
			// A hard shadow is an offset copy of the edge, so a hairline becomes 1px.
			border: "1",
			shadow: "sm",
			shadowStyle: "hard",
			sidebarStyle: "floating",
			sidebarTone: "brand",
			activeItem: "pill",
			header: "plain",
			frame: "outlined",
			icons: "bold",
			// Hue tiles melt into a brand sidebar, so color becomes soft.
			navIcon: "soft",
			scale: "lg",
			content: "centered",
			sidebarCollapse: "rail",
			sidebarStart: "collapsed",
			userMenu: "sidebar-header",
		});
	});
});
