/**
 * The design worlds of the V2 mobile template, as the server needs them.
 * It holds the card face of each mobile world and the world order of one project.
 * The world documents are in templates/mobile-app/.claude/skills/design-worlds-mobile.
 * `worldCardOf` (index.ts) and the builder-turn runtime call this file.
 */
import { createHash } from "node:crypto";

import type { WorldCard } from "@wandit/contracts";

/**
 * One card per mobile world, in the order of the index skill. `preview.fontFamily`
 * is a Google Fonts family: the chat tray loads it to draw the sample word.
 */
export const mobileWorldCards: readonly WorldCard[] = [
	{
		id: "aurore",
		name: "Aurore",
		tagline:
			"Deep indigo night with drifting teal, violet, and green glows behind glass panels, and a teal caret that blinks where the app waits or writes.",
		preview: {
			ground: "#07071a",
			ink: "#eef0ff",
			accent: "#5eead4",
			fontFamily: "Sora",
			sampleWord: "Aurora",
		},
	},
	{
		id: "boudoir",
		name: "Boudoir",
		tagline:
			"Blush plaster, a bronze mirror, and framed portraits: a serif hour for each visit, hairline rules, and labels in spaced capitals.",
		preview: {
			ground: "#f2eae5",
			ink: "#211a17",
			accent: "#8a5a35",
			fontFamily: "Cormorant Garamond",
			sampleWord: "Atelier",
		},
	},
	{
		id: "cadence",
		name: "Cadence",
		tagline:
			"A white page, one electric orange, and a ring that closes every day: big light numbers, week dots, and a streak that lights up.",
		preview: {
			ground: "#ffffff",
			ink: "#141413",
			accent: "#ff4d00",
			fontFamily: "Lexend",
			sampleWord: "Streak",
		},
	},
	{
		id: "criee",
		name: "Criée",
		tagline:
			"A loud flea-market poster wall: cream paper, thick black edges, hard offset shadows, tilted stickers, and a running ticker band.",
		preview: {
			ground: "#ffd43b",
			ink: "#121212",
			accent: "#2348f0",
			fontFamily: "Archivo Black",
			sampleWord: "Bargain",
		},
	},
	{
		id: "marelle",
		name: "Marelle",
		tagline:
			"Candy pastels and plum ink: round sticker avatars with a white edge and a tilt, wavy lines, confetti dots, and entries that bounce.",
		preview: {
			ground: "#fff8f3",
			ink: "#3a1c4a",
			accent: "#c8296a",
			fontFamily: "Fredoka",
			sampleWord: "Hopscotch",
		},
	},
	{
		id: "minuit",
		name: "Minuit",
		tagline:
			"A violet-black room lit by one magenta-to-tangerine gradient, with torn ticket stubs, glass that floats, and lowercase poster type that glows.",
		preview: {
			ground: "#0b0712",
			ink: "#f7f2ff",
			accent: "#ff3d9a",
			fontFamily: "Space Grotesk",
			sampleWord: "Tonight",
		},
	},
	{
		id: "mosaique",
		name: "Mosaïque",
		tagline:
			"Four pastel index cards on a pinboard: a bento of tinted tiles, mono capital tags, and a checkbox that snaps shut.",
		preview: {
			ground: "#f5f4f0",
			ink: "#141416",
			accent: "#141416",
			fontFamily: "Geist",
			sampleWord: "Sorted",
		},
	},
	{
		id: "potager",
		name: "Potager",
		tagline:
			"Seed-packet cream, sage leaves, and clay pots: soft soil blobs, a hand-drawn sprig, and season chips for apps that grow things.",
		preview: {
			ground: "#f5f0e3",
			ink: "#1e2a1f",
			accent: "#3d6b47",
			fontFamily: "Bricolage Grotesque",
			sampleWord: "Sprout",
		},
	},
	{
		id: "pouls",
		name: "Pouls",
		tagline:
			"A calm clinic at 8:55: white walls, deep teal ink, big light numerals, and one steady heartbeat line across every screen.",
		preview: {
			ground: "#f5f8f8",
			ink: "#0e2a2e",
			accent: "#0b7a74",
			fontFamily: "Figtree",
			sampleWord: "Pulse",
		},
	},
	{
		id: "recre",
		name: "Récré",
		tagline:
			"A bright sky page of chunky buttons that sink under the thumb, tilted stickers, and a timetable that fills with teacher stamps.",
		preview: {
			ground: "#8ad4ff",
			ink: "#0f2747",
			accent: "#0a72cc",
			fontFamily: "Baloo 2",
			sampleWord: "Recess",
		},
	},
	{
		id: "registre",
		name: "Registre",
		tagline:
			"A clean back office before the doors open: cool paper, blue-black ink, cobalt KPI tiles with live sparklines, and a now line across today's agenda.",
		preview: {
			ground: "#f3f5f9",
			ink: "#0f1a2e",
			accent: "#1e4bd2",
			fontFamily: "Plus Jakarta Sans",
			sampleWord: "Ledger",
		},
	},
	{
		id: "revue",
		name: "Revue",
		tagline:
			"A printed catalogue on ivory paper: edge-to-edge photos with captions, serif titles with one italic word, and a terracotta add bar.",
		preview: {
			ground: "#f5f0e6",
			ink: "#161412",
			accent: "#a3461f",
			fontFamily: "Instrument Serif",
			sampleWord: "Edition",
		},
	},
	{
		id: "riad",
		name: "Riad",
		tagline:
			"Sand plaster by day, indigo by night: every photo framed in an arch, a band of eight-point stars, brass lines, and a calm host's voice.",
		preview: {
			ground: "#f4ecdf",
			ink: "#1b2340",
			accent: "#ae4e27",
			fontFamily: "Marcellus",
			sampleWord: "Courtyard",
		},
	},
	{
		id: "solde",
		name: "Solde",
		tagline:
			"A clean paper ledger with amounts typed in mono, a navy card engraved like a banknote, and one mint line that says the account is fine.",
		preview: {
			ground: "#f6f6f1",
			ink: "#0d1a2f",
			accent: "#0b7a57",
			fontFamily: "Manrope",
			sampleWord: "Balance",
		},
	},
	{
		id: "souffle",
		name: "Souffle",
		tagline:
			"A dawn sky of lavender and peach, or indigo and plum at night, with one glowing orb that breathes and a soft serif that greets you by the hour.",
		preview: {
			ground: "#fbf4ef",
			ink: "#2b2340",
			accent: "#6650a6",
			fontFamily: "Fraunces",
			sampleWord: "Breathe",
		},
	},
	{
		id: "tablee",
		name: "Tablée",
		tagline:
			"Cream linen, tomato red, and saffron: every dish sits on a round color plate, and the menu reads like a bistro card with dotted leaders.",
		preview: {
			ground: "#fbf3e6",
			ink: "#2a1a12",
			accent: "#c9361c",
			fontFamily: "Young Serif",
			sampleWord: "Supper",
		},
	},
	{
		id: "trajet",
		name: "Trajet",
		tagline:
			"A night dispatch screen in slate and safety amber: a dashed route line, a live status timeline, and big condensed arrival minutes.",
		preview: {
			ground: "#0f1318",
			ink: "#eef1f4",
			accent: "#ffb224",
			fontFamily: "Oswald",
			sampleWord: "Arriving",
		},
	},
	{
		id: "vestiaire",
		name: "Vestiaire",
		tagline:
			"Black steel and one electric volt: giant condensed numbers, black-and-white athletes, and a coach's voice.",
		preview: {
			ground: "#0b0b0c",
			ink: "#f4f4f0",
			accent: "#d4ff3a",
			fontFamily: "Anton",
			sampleWord: "REPS",
		},
	},
];

/**
 * The world ids of one card list in a fixed order for one project. The order
 * differs between projects, so two similar briefs get different shortlists.
 * The order stays the same for every turn of one project.
 * The reason: the turn instructions are part of the warm session key (persistent-run-turn.mjs).
 */
export function worldOrder(
	projectId: string,
	cards: readonly WorldCard[],
): string[] {
	// A rank from a hash of the project and the world: a seeded shuffle with no state.
	const rankOf = (worldId: string) =>
		createHash("sha256")
			.update(`${projectId}:${worldId}`)
			.digest()
			.readUInt32BE(0);
	return cards
		.map((card) => ({ id: card.id, rank: rankOf(card.id) }))
		.sort((left, right) => left.rank - right.rank)
		.map((entry) => entry.id);
}
