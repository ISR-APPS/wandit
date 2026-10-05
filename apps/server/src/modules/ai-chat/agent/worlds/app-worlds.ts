/**
 * The design worlds of the V2 app templates, as the server needs them.
 * It holds the card face of each mobile world and each web app world, and the
 * world order of one project. The world documents are in the templates:
 * mobile-app/.claude/skills/design-worlds-mobile and web-app/.claude/skills/design-worlds-app.
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
 * One card per web app world (a workspace look: SaaS, admin, CRM, portal), in the
 * order of the design-worlds-app index skill. Same card rules as the mobile cards.
 */
export const webAppWorldCards: readonly WorldCard[] = [
	{
		id: "bordereau",
		name: "Bordereau",
		tagline:
			"A statement slip on paper: a serif greeting, mono amounts in hairline columns, and one money bar that splits overdue from not yet due.",
		preview: {
			ground: "#fbfbf8",
			ink: "#111111",
			accent: "#c2401f",
			fontFamily: "Newsreader",
			sampleWord: "Invoice",
		},
	},
	{
		id: "brigade",
		name: "Brigade",
		tagline:
			"Kitchen paper, burnt-ink bands, and one tomato red: live ticket timers on the pass, a roster on the wall, and capitals that call the service.",
		preview: {
			ground: "#faf3e6",
			ink: "#1f1410",
			accent: "#d9381e",
			fontFamily: "Big Shoulders Display",
			sampleWord: "SERVICE",
		},
	},
	{
		id: "brume",
		name: "Brume",
		tagline:
			"Pearl calm with a lavender and peach mist behind one floating composer, a serif greeting, cited answers, and quiet lists.",
		preview: {
			ground: "#fcfbfd",
			ink: "#1b1a22",
			accent: "#d9d2ff",
			fontFamily: "Instrument Serif",
			sampleWord: "Ask",
		},
	},
	{
		id: "cadran",
		name: "Cadran",
		tagline:
			"A precision dial for SaaS metrics: KPI tabs that swap the chart, small multiples, hatched no-data bands, and one violet-blue needle.",
		preview: {
			ground: "#fcfcfd",
			ink: "#101114",
			accent: "#5b4bff",
			fontFamily: "Geist",
			sampleWord: "Retention",
		},
	},
	{
		id: "chevet",
		name: "Chevet",
		tagline:
			"Porcelain and pine for a calm practice: a soft day agenda, lab values on their normal range, and one Next patient card.",
		preview: {
			ground: "#f1eee6",
			ink: "#14302b",
			accent: "#1f6f5c",
			fontFamily: "Source Serif 4",
			sampleWord: "Visit",
		},
	},
	{
		id: "coffre",
		name: "Coffre",
		tagline:
			"A bank vault after hours: steel cards, mono uppercase eyebrows, a blue balance line with a glowing end dot, and a spending heatmap.",
		preview: {
			ground: "#07090c",
			ink: "#e9eef5",
			accent: "#3d8bff",
			fontFamily: "Schibsted Grotesk",
			sampleWord: "Balance",
		},
	},
	{
		id: "comptoir",
		name: "Comptoir",
		tagline:
			"A grey stockroom canvas, white order slips, and a dark counter slab that holds the search. Cash green means done, amber means waiting.",
		preview: {
			ground: "#f1f1f0",
			ink: "#1c1c1b",
			accent: "#0a6b37",
			fontFamily: "Albert Sans",
			sampleWord: "Orders",
		},
	},
	{
		id: "coulisses",
		name: "Coulisses",
		tagline:
			"Backstage in violet-black: every event is a ticket stub with torn notches, tiers fill with a magenta-to-tangerine glow, and the door count pulses live.",
		preview: {
			ground: "#0f0a17",
			ink: "#f6f1ff",
			accent: "#ff3d9a",
			fontFamily: "Syne",
			sampleWord: "Tonight",
		},
	},
	{
		id: "creneau",
		name: "Créneau",
		tagline:
			"A warm white appointment book on a dark aubergine rail: staff columns, hatched closed hours, a moving now line, and stacked date blocks.",
		preview: {
			ground: "#fbfaf8",
			ink: "#1d1b26",
			accent: "#5b2a86",
			fontFamily: "Urbanist",
			sampleWord: "Booked",
		},
	},
	{
		id: "effectif",
		name: "Effectif",
		tagline:
			"A deep green frame, a lilac band of morning light, and a people directory you scan by letter: HR that feels kind and in control.",
		preview: {
			ground: "#fbf8f3",
			ink: "#1d2a24",
			accent: "#1f5a43",
			fontFamily: "Familjen Grotesk",
			sampleWord: "Team",
		},
	},
	{
		id: "etabli",
		name: "Établi",
		tagline:
			"A graphite workbench under one tangerine lamp: grouped rows with status circles, mono IDs, a command palette, and a key for every action.",
		preview: {
			ground: "#0f0f11",
			ink: "#e8e8ea",
			accent: "#ff7a1a",
			fontFamily: "Inter",
			sampleWord: "Sprint",
		},
	},
	{
		id: "fiche",
		name: "Fiche",
		tagline:
			"A white card file with typed column icons, pastel tags, filter tokens, and a timeline that shows each change as old value to new value.",
		preview: {
			ground: "#ffffff",
			ink: "#18181b",
			accent: "#0369a1",
			fontFamily: "Instrument Sans",
			sampleWord: "Pipeline",
		},
	},
	{
		id: "preau",
		name: "Préau",
		tagline:
			"Sky paper, cobalt ink, and a sunflower sticker on today: mastery bars, progress-ring avatars, and a subject-color timetable.",
		preview: {
			ground: "#e4ecff",
			ink: "#13213c",
			accent: "#2457ff",
			fontFamily: "Gabarito",
			sampleWord: "Class",
		},
	},
	{
		id: "regie",
		name: "Régie",
		tagline:
			"A night dispatch floor in slate, where safety orange lights only the jobs that need a person and every ETA reads like a departure board.",
		preview: {
			ground: "#0d1015",
			ink: "#e7ecf3",
			accent: "#ff6f1a",
			fontFamily: "Saira Condensed",
			sampleWord: "ETA",
		},
	},
	{
		id: "sonde",
		name: "Sonde",
		tagline:
			"A graphite console for dev and AI ops: status-dot rows with mono hashes, a live status bar with a UTC clock, and one green signal.",
		preview: {
			ground: "#0b0c0e",
			ink: "#e6e8eb",
			accent: "#3dd68c",
			fontFamily: "IBM Plex Sans",
			sampleWord: "Deploy",
		},
	},
	{
		id: "tampon",
		name: "Tampon",
		tagline:
			"Cream paper, black 1 px boxes, and one hot pink stamp. Buttons lift on hover and stamp down, for creators who sell.",
		preview: {
			ground: "#f4f4f0",
			ink: "#000000",
			accent: "#ff7ac6",
			fontFamily: "Rethink Sans",
			sampleWord: "Sales",
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
