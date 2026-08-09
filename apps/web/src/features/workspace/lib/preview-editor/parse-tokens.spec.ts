import { PAGE_TOKEN_NAMES, type PageTokenName } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	extractGoogleFontStylesheetHrefs,
	hasCompletePageTheme,
	normalizeTokenValue,
	parsePageTheme,
	parsePageTokens,
	tokensEqual,
} from "./parse-tokens";

describe("extractGoogleFontStylesheetHrefs", () => {
	it("returns unique builder Google Font stylesheets and decodes query params", () => {
		const href =
			"https://fonts.googleapis.com/css2?family=Fraunces&amp;display=swap";
		const html = `<head>
			<link rel="preconnect" href="https://fonts.googleapis.com">
			<link rel="stylesheet" href="${href}">
			<link href="${href}" rel="stylesheet">
			<link rel="stylesheet" href="https://evil.example/fonts.css">
			<link rel="stylesheet" href="https://fonts.googleapis.com.evil/fonts.css">
			<link rel="stylesheet" href="https://fonts.googleapis.com/
			css2?family=Unsafe">
		</head>`;

		expect(extractGoogleFontStylesheetHrefs(html)).toEqual([
			"https://fonts.googleapis.com/css2?family=Fraunces&display=swap",
		]);
	});
});

const COMPLETE_TOKENS = {
	background: "#fafafa",
	foreground: "#101010",
	primary: "#336699",
	"primary-foreground": "#ffffff",
	secondary: "#eeeeee",
	accent: "rgb(240 120 20)",
	muted: "#777777",
	border: "#dddddd",
	radius: "0.75rem",
	"font-heading": '"Cairo", sans-serif',
	"font-body": '"Manrope", sans-serif',
} as const satisfies Record<PageTokenName, string>;

function rootDeclarations(
	tokens: Partial<Record<PageTokenName, string>> = COMPLETE_TOKENS,
) {
	return PAGE_TOKEN_NAMES.flatMap((name) => {
		const value = tokens[name];
		return value ? [`--${name}: ${value};`] : [];
	}).join("\n");
}

describe("parsePageTheme", () => {
	it("reads tokens and the preferred scheme from the first relevant root", () => {
		const html = `<style>.early { color: red; }</style>
			<style>:root { color-scheme: dark light; ${rootDeclarations()} }</style>
			<style>:root { color-scheme: light; --background: #ffffff; }</style>`;

		expect(parsePageTheme(html)).toEqual({
			tokens: COMPLETE_TOKENS,
			colorScheme: "dark",
		});
		expect(parsePageTokens(html)).toEqual(COMPLETE_TOKENS);
	});

	it("supports the only keyword and ignores similarly named declarations", () => {
		const html = `<style>:root {
			--color-scheme: light;
			color-scheme: only dark;
			--primary-foreground: #ffffff;
		}</style>`;

		expect(parsePageTheme(html)).toEqual({
			tokens: { "primary-foreground": "#ffffff" },
			colorScheme: "dark",
		});
	});

	it("returns an empty, scheme-less theme when no root exists", () => {
		expect(parsePageTheme("<style>body { color: red; }</style>")).toEqual({
			tokens: {},
			colorScheme: null,
		});
	});
});

describe("hasCompletePageTheme", () => {
	it("requires the complete 11-token generation contract", () => {
		expect(hasCompletePageTheme(COMPLETE_TOKENS)).toBe(true);
		expect(Object.keys(COMPLETE_TOKENS)).toHaveLength(11);
	});

	it("rejects near-empty and almost-complete legacy signatures", () => {
		expect(
			hasCompletePageTheme({ background: "#fff", foreground: "#111" }),
		).toBe(false);
		const { accent: _missing, ...almostComplete } = COMPLETE_TOKENS;
		expect(hasCompletePageTheme(almostComplete)).toBe(false);
	});
});

describe("theme token equality", () => {
	it("normalizes functional colors and curated font stacks", () => {
		expect(normalizeTokenValue("background", "rgb(250 250 250)")).toBe(
			"#fafafa",
		);
		expect(
			tokensEqual(COMPLETE_TOKENS, {
				...COMPLETE_TOKENS,
				background: "rgb(250 250 250)",
				"font-heading": "cairo",
			}),
		).toBe(true);
	});

	it("requires both themes to carry all 11 values", () => {
		const { accent: _missing, ...incomplete } = COMPLETE_TOKENS;
		expect(tokensEqual(COMPLETE_TOKENS, incomplete)).toBe(false);
	});
});
