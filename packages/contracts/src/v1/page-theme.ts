/**
 * Shared theme vocabulary for generated pages (V2 spec §3b/§8): the fixed
 * design-token names, the curated Google-font list, and the preset palettes.
 * Server validates ops against these; web renders pickers/presets from them.
 */
import { z } from "zod";

export const PAGE_TOKEN_NAMES = [
	"background",
	"foreground",
	"primary",
	"primary-foreground",
	"secondary",
	"accent",
	"muted",
	"border",
	"radius",
	"font-heading",
	"font-body",
] as const;

export type PageTokenName = (typeof PAGE_TOKEN_NAMES)[number];

export type CuratedFont = {
	id: string;
	family: string;
	/** Generic CSS fallback written after the family. */
	fallback: "sans-serif" | "serif";
	/** Google Fonts css2 family spec (already URL-encoded family name + axes). */
	css2: string;
	arabic: boolean;
	/** Recommended usage — the theme panel offers heading-capable fonts for
	 *  --font-heading and body-capable fonts for --font-body. */
	heading: boolean;
	body: boolean;
};

export const CURATED_FONTS: readonly CuratedFont[] = [
	{
		id: "cairo",
		family: "Cairo",
		fallback: "sans-serif",
		css2: "Cairo:wght@400;600;700;800;900",
		arabic: true,
		heading: true,
		body: true,
	},
	{
		id: "tajawal",
		family: "Tajawal",
		fallback: "sans-serif",
		css2: "Tajawal:wght@400;500;700;800",
		arabic: true,
		heading: true,
		body: true,
	},
	{
		id: "almarai",
		family: "Almarai",
		fallback: "sans-serif",
		css2: "Almarai:wght@300;400;700;800",
		arabic: true,
		heading: true,
		body: true,
	},
	{
		id: "ibm-plex-sans-arabic",
		family: "IBM Plex Sans Arabic",
		fallback: "sans-serif",
		css2: "IBM+Plex+Sans+Arabic:wght@400;500;600;700",
		arabic: true,
		heading: true,
		body: true,
	},
	{
		id: "readex-pro",
		family: "Readex Pro",
		fallback: "sans-serif",
		css2: "Readex+Pro:wght@400;500;600;700",
		arabic: true,
		heading: true,
		body: true,
	},
	{
		id: "changa",
		family: "Changa",
		fallback: "sans-serif",
		css2: "Changa:wght@400;600;700;800",
		arabic: true,
		heading: true,
		body: false,
	},
	{
		id: "el-messiri",
		family: "El Messiri",
		fallback: "sans-serif",
		css2: "El+Messiri:wght@400;600;700",
		arabic: true,
		heading: true,
		body: false,
	},
	{
		id: "noto-kufi-arabic",
		family: "Noto Kufi Arabic",
		fallback: "sans-serif",
		css2: "Noto+Kufi+Arabic:wght@400;600;700",
		arabic: true,
		heading: true,
		body: false,
	},
	{
		id: "playfair-display",
		family: "Playfair Display",
		fallback: "serif",
		css2: "Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400",
		arabic: false,
		heading: true,
		body: false,
	},
	{
		id: "fraunces",
		family: "Fraunces",
		fallback: "serif",
		css2: "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,900",
		arabic: false,
		heading: true,
		body: false,
	},
	{
		id: "space-grotesk",
		family: "Space Grotesk",
		fallback: "sans-serif",
		css2: "Space+Grotesk:wght@400;500;700",
		arabic: false,
		heading: true,
		body: true,
	},
	{
		id: "manrope",
		family: "Manrope",
		fallback: "sans-serif",
		css2: "Manrope:wght@400;500;600;700;800",
		arabic: false,
		heading: true,
		body: true,
	},
] as const;

export const curatedFontIdSchema = z.enum(
	CURATED_FONTS.map((font) => font.id) as [string, ...string[]],
);

export type CuratedFontId = z.infer<typeof curatedFontIdSchema>;

export function curatedFontById(id: string): CuratedFont | undefined {
	return CURATED_FONTS.find((font) => font.id === id);
}

/** CSS font-family stack for a curated font, e.g. `"Cairo", sans-serif`. */
export function curatedFontStack(id: CuratedFontId): string {
	const font = curatedFontById(id);
	return font ? `"${font.family}", ${font.fallback}` : "sans-serif";
}

export type PresetPalette = {
	id: string;
	name: string;
	mode: "light" | "dark";
	/** Flatters RTL/Arabic e-commerce aesthetics. */
	rtlFriendly: boolean;
	values: Record<PageTokenName, string>; // fonts as curated ids
};

export const PRESET_PALETTES: readonly PresetPalette[] = [
	{
		id: "dune-chaude",
		name: "Dune chaude",
		mode: "light",
		rtlFriendly: true,
		values: {
			background: "#FBF6ED",
			foreground: "#2C2216",
			primary: "#B4551F",
			"primary-foreground": "#FFF7EF",
			secondary: "#F1E7D6",
			accent: "#1F6E5C",
			muted: "#7A6A58",
			border: "#E7DCC8",
			radius: "0.9rem",
			"font-heading": "cairo",
			"font-body": "tajawal",
		},
	},
	{
		id: "oasis-menthe",
		name: "Oasis menthe",
		mode: "light",
		rtlFriendly: true,
		values: {
			background: "#F4FAF6",
			foreground: "#0E2A20",
			primary: "#0C7A5B",
			"primary-foreground": "#F0FDF7",
			secondary: "#E2F2E9",
			accent: "#C99A2E",
			muted: "#5B7268",
			border: "#D5E6DC",
			radius: "1rem",
			"font-heading": "readex-pro",
			"font-body": "ibm-plex-sans-arabic",
		},
	},
	{
		id: "zellige-bleu",
		name: "Zellige bleu",
		mode: "light",
		rtlFriendly: true,
		values: {
			background: "#F7F3EA",
			foreground: "#1B2A41",
			primary: "#174F7C",
			"primary-foreground": "#F3F8FC",
			secondary: "#EAE2D2",
			accent: "#B0672F",
			muted: "#5C6470",
			border: "#DED4C0",
			radius: "0.5rem",
			"font-heading": "el-messiri",
			"font-body": "almarai",
		},
	},
	{
		id: "sable-turquoise",
		name: "Sable & turquoise",
		mode: "light",
		rtlFriendly: true,
		values: {
			background: "#FCFAF4",
			foreground: "#1C3238",
			primary: "#0F707B",
			"primary-foreground": "#ECFEFF",
			secondary: "#EAF3F0",
			accent: "#D97C2B",
			muted: "#5D7272",
			border: "#DFE9E2",
			radius: "0.875rem",
			"font-heading": "noto-kufi-arabic",
			"font-body": "almarai",
		},
	},
	{
		id: "lin-naturel",
		name: "Lin naturel",
		mode: "light",
		rtlFriendly: false,
		values: {
			background: "#FAF9F5",
			foreground: "#22211C",
			primary: "#4F6A34",
			"primary-foreground": "#F6FAF0",
			secondary: "#EFEDE4",
			accent: "#8A3B12",
			muted: "#6E6B60",
			border: "#E3E0D5",
			radius: "0.375rem",
			"font-heading": "fraunces",
			"font-body": "manrope",
		},
	},
	{
		id: "rose-poudre",
		name: "Rose poudré",
		mode: "light",
		rtlFriendly: false,
		values: {
			background: "#FDF7F6",
			foreground: "#3A222A",
			primary: "#A93F63",
			"primary-foreground": "#FFF3F7",
			secondary: "#F7E8EA",
			accent: "#C9A05A",
			muted: "#8A6E76",
			border: "#F0DCE0",
			radius: "1.25rem",
			"font-heading": "playfair-display",
			"font-body": "manrope",
		},
	},
	{
		id: "agrume",
		name: "Agrume",
		mode: "light",
		rtlFriendly: false,
		values: {
			background: "#FFFDF6",
			foreground: "#1F1B0E",
			primary: "#C94E0A",
			"primary-foreground": "#FFF8F1",
			secondary: "#FFF3D6",
			accent: "#F5B700",
			muted: "#6B6350",
			border: "#F2E8CE",
			radius: "1rem",
			"font-heading": "space-grotesk",
			"font-body": "manrope",
		},
	},
	{
		id: "mediterranee",
		name: "Méditerranée",
		mode: "light",
		rtlFriendly: false,
		values: {
			background: "#F8FBFD",
			foreground: "#12263A",
			primary: "#0D5C97",
			"primary-foreground": "#F1F8FF",
			secondary: "#E8F1F8",
			accent: "#E4572E",
			muted: "#5C6B78",
			border: "#DBE6EF",
			radius: "0.75rem",
			"font-heading": "ibm-plex-sans-arabic",
			"font-body": "tajawal",
		},
	},
	{
		id: "amande-douce",
		name: "Amande douce",
		mode: "light",
		rtlFriendly: false,
		values: {
			background: "#F9F8F2",
			foreground: "#2E2A22",
			primary: "#4F7A2E",
			"primary-foreground": "#F6FBEF",
			secondary: "#EEF0E0",
			accent: "#8A5A2B",
			muted: "#6F6C5C",
			border: "#E2E2CF",
			radius: "1.25rem",
			"font-heading": "readex-pro",
			"font-body": "tajawal",
		},
	},
	{
		id: "papier-encre",
		name: "Papier & encre",
		mode: "light",
		rtlFriendly: false,
		values: {
			background: "#FFFFFF",
			foreground: "#141414",
			primary: "#141414",
			"primary-foreground": "#FFFFFF",
			secondary: "#F4F4F2",
			accent: "#D62828",
			muted: "#6B6B6B",
			border: "#E6E6E3",
			radius: "0rem",
			"font-heading": "fraunces",
			"font-body": "space-grotesk",
		},
	},
	{
		id: "nuit-saharienne",
		name: "Nuit saharienne",
		mode: "dark",
		rtlFriendly: true,
		values: {
			background: "#17120C",
			foreground: "#F3E9DA",
			primary: "#E08A2F",
			"primary-foreground": "#241505",
			secondary: "#241D13",
			accent: "#F2C879",
			muted: "#A08F78",
			border: "#332A1D",
			radius: "0.75rem",
			"font-heading": "changa",
			"font-body": "tajawal",
		},
	},
	{
		id: "kohl-et-or",
		name: "Kohl & or",
		mode: "dark",
		rtlFriendly: true,
		values: {
			background: "#14120F",
			foreground: "#EFE7DA",
			primary: "#C9A227",
			"primary-foreground": "#191307",
			secondary: "#1E1B15",
			accent: "#3E8E7E",
			muted: "#9C9282",
			border: "#2C2820",
			radius: "0.375rem",
			"font-heading": "el-messiri",
			"font-body": "almarai",
		},
	},
	{
		id: "foret-profonde",
		name: "Forêt profonde",
		mode: "dark",
		rtlFriendly: false,
		values: {
			background: "#0F1B15",
			foreground: "#ECF3EC",
			primary: "#D9A441",
			"primary-foreground": "#1B1305",
			secondary: "#16261E",
			accent: "#7FC8A9",
			muted: "#93A89A",
			border: "#23372C",
			radius: "0.75rem",
			"font-heading": "fraunces",
			"font-body": "manrope",
		},
	},
	{
		id: "encre-electrique",
		name: "Encre électrique",
		mode: "dark",
		rtlFriendly: false,
		values: {
			background: "#0B1220",
			foreground: "#E6ECF7",
			primary: "#2457C5",
			"primary-foreground": "#EFF4FF",
			secondary: "#131C2E",
			accent: "#A3E635",
			muted: "#8B98AE",
			border: "#22304A",
			radius: "0.5rem",
			"font-heading": "space-grotesk",
			"font-body": "manrope",
		},
	},
	{
		id: "bordeaux-nuit",
		name: "Bordeaux nuit",
		mode: "dark",
		rtlFriendly: false,
		values: {
			background: "#190D10",
			foreground: "#F5E9E4",
			primary: "#A63A50",
			"primary-foreground": "#FFF0F0",
			secondary: "#251317",
			accent: "#D9B98A",
			muted: "#A18A8A",
			border: "#38232B",
			radius: "0.625rem",
			"font-heading": "playfair-display",
			"font-body": "manrope",
		},
	},
	{
		id: "basalte",
		name: "Basalte",
		mode: "dark",
		rtlFriendly: false,
		values: {
			background: "#131417",
			foreground: "#EDEEF0",
			primary: "#F25C05",
			"primary-foreground": "#1D0E02",
			secondary: "#1C1E22",
			accent: "#4FB8DF",
			muted: "#979CA6",
			border: "#272A30",
			radius: "0.25rem",
			"font-heading": "space-grotesk",
			"font-body": "ibm-plex-sans-arabic",
		},
	},
] as const;
