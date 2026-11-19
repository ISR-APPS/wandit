// The words of the sample posts: a headline and a caption per content pillar, with fictional people and places.
// sample-data.ts calls writePost() for each post. Nothing else reads this file.
// Every name here is invented. The magazine, its city, its venues, and its artists do not exist.
import type { Pillar } from "./post-vocabulary";

/** One written post: the headline that the team sees in lists, the caption, and the hashtags. */
export type PostCopy = {
	title: string;
	caption: string;
	/** Each tag with its leading "#", for example "#cityguide". */
	hashtags: string[];
};

type Template = { title: string; caption: string };

const PEOPLE = [
	"Ada Rennick",
	"Joon Park-Ellis",
	"Marisol Vane",
	"Teodor Blum",
	"Priya Castellan",
	"Ezra Holloway",
	"Linnea Ostrand",
	"Kofi Mensah-Hart",
	"Delphine Arroyo",
	"Rafe Whitcombe",
	"Yara Soltani",
	"Hugo Brennan",
];

const PLACES = [
	"the Lantern Rooms",
	"Quayside Hall",
	"the Old Ropeworks",
	"Marlowe Street Market",
	"the Glasshouse Cinema",
	"Saltmarsh Gallery",
	"Pennant Yard",
	"the Cobalt Club",
	"Willow Lane Bakery",
	"the Tidal Bookshop",
	"Arkwright Studios",
	"Harbour Steps",
];

const AREAS = [
	"Fernhill",
	"Harbourside",
	"the Old Quarter",
	"Kingsmead Rise",
	"Copperfield Row",
	"St Agnes Vale",
	"Millbrook",
	"Lowther Docks",
	"Eastgate",
	"Brindle Hill",
	"Ashcombe",
	"Tannery Lane",
];

const WORKS = [
	"Low Tide Hymns",
	"The Paper Orchard",
	"Glass Weather",
	"North of Quiet",
	"Small Hours",
	"A House of Kites",
	"Ember and Ash",
	"The Long Field",
	"Salt Letters",
	"Midnight Ferry",
	"Copper Season",
	"Blue Static",
];

const TEMPLATES: Record<Pillar, readonly Template[]> = {
	interviews: [
		{
			title: "Five questions for {person}",
			caption:
				"{person} talks about the slow years, the studio, and the piece that changed everything. Full interview in the new issue.",
		},
		{
			title: "In the studio with {person}",
			caption:
				"We spent a morning at {place} with {person}. Coffee, clay dust, and very honest answers.",
		},
		{
			title: "{person} on making work in {area}",
			caption:
				"Why {person} stayed in {area} when everyone left, and what the neighbourhood gives back.",
		},
		{
			title: "The playlist of {person}",
			caption:
				"Ten songs that {person} plays on repeat while working on “{work}”. Press play and read along.",
		},
		{
			title: "Ten minutes with {person}",
			caption:
				"A short walk around {area} with {person}, and one question we never planned to ask.",
		},
		{
			title: "What {person} reads on Sundays",
			caption:
				"Three books, one magazine, and a cookbook with a broken spine. {person} shares the shelf.",
		},
	],
	cityGuide: [
		{
			title: "A slow Saturday in {area}",
			caption:
				"Bakeries, a bookshop, and a quiet bench by the water. Our route through {area}, step by step.",
		},
		{
			title: "Where to eat near {place}",
			caption:
				"Six tables within ten minutes of {place}, from a counter lunch to a long dinner.",
		},
		{
			title: "{area} after dark",
			caption:
				"Late bars, one open studio, and the best chips in town. A night in {area}, mapped.",
		},
		{
			title: "The new café everyone talks about in {area}",
			caption:
				"Good coffee, a tiny garden, and a queue that moves fast. Swipe for the menu highlights.",
		},
		{
			title: "A walking map of {area}",
			caption:
				"Two hours, eight stops, zero hills (almost). Save this for your next free afternoon.",
		},
		{
			title: "Rainy day plan: {place}",
			caption:
				"When the weather turns, {place} stays warm. What to see, where to sit, and what to order.",
		},
	],
	reviews: [
		{
			title: "Review: {work}",
			caption:
				"Our critic on “{work}”: tender, strange, and worth a second listen. Read the full review.",
		},
		{
			title: "Why “{work}” is our record of the month",
			caption:
				"Quiet songs with sharp edges. Three reasons “{work}” stays on our turntable.",
		},
		{
			title: "First look: {work} at {place}",
			caption:
				"Opening night of “{work}” at {place}. Our notes from the second row.",
		},
		{
			title: "Three stars for “{work}”",
			caption:
				"Beautiful to look at, slow in the middle. Our honest verdict on “{work}”.",
		},
		{
			title: "“{work}”: the verdict",
			caption:
				"Four writers, one book, very different opinions. The round table on “{work}”.",
		},
	],
	events: [
		{
			title: "This week at {place}",
			caption:
				"Talks, a late opening, and live music. Everything on at {place} this week.",
		},
		{
			title: "Tickets on sale: {work} live",
			caption:
				"“{work}” comes to {place} for two nights only. Readers get early access with the code in our bio.",
		},
		{
			title: "Open studios in {area}",
			caption:
				"Twenty artists open their doors in {area} this weekend. Free entry, map in the link.",
		},
		{
			title: "Weekend list: {area} edition",
			caption:
				"A market, a film club, and a dawn swim. Our picks for the weekend in {area}.",
		},
		{
			title: "Late opening at {place}",
			caption:
				"Doors open until 22:00 tonight at {place}. Bring a friend and stay for the talk.",
		},
	],
	studio: [
		{
			title: "Behind the cover of issue {issue}",
			caption:
				"Three shoots, one rainy afternoon, and lucky light. How the cover of issue {issue} came together.",
		},
		{
			title: "Proofs on the desk: issue {issue}",
			caption:
				"Red pens out. A first look at the pages of issue {issue} before they go to print.",
		},
		{
			title: "Editors' picks from issue {issue}",
			caption:
				"Each editor chose one page of issue {issue}. Swipe to see which and why.",
		},
		{
			title: "Packing day for issue {issue}",
			caption:
				"Two thousand copies, one long table, and a lot of tape. Issue {issue} is on its way.",
		},
	],
};

const HASHTAGS: Record<Pillar, readonly string[]> = {
	interviews: ["#fernhillreview", "#interview", "#artiststudio"],
	cityGuide: ["#fernhillreview", "#cityguide", "#weekendplans"],
	reviews: ["#fernhillreview", "#review", "#newmusic"],
	events: ["#fernhillreview", "#whatson", "#thisweekend"],
	studio: ["#fernhillreview", "#behindthescenes", "#printisnotdead"],
};

// The first issue number of the studio posts. Each new studio post names the next issue.
const FIRST_ISSUE = 41;

function fill(template: string, slot: number, issue: number): string {
	return template
		.replaceAll("{person}", PEOPLE[slot % PEOPLE.length] ?? "")
		.replaceAll("{place}", PLACES[(slot + 4) % PLACES.length] ?? "")
		.replaceAll("{area}", AREAS[(slot + 7) % AREAS.length] ?? "")
		.replaceAll("{work}", WORKS[(slot + 2) % WORKS.length] ?? "")
		.replaceAll("{issue}", String(issue));
}

/**
 * The copy of the `count`-th post of one pillar (0 first). Each template takes the names in turn,
 * so a pillar repeats a headline only after 12 rounds of its templates.
 */
export function writePost(pillar: Pillar, count: number): PostCopy {
	const templates = TEMPLATES[pillar];
	const templateIndex = count % templates.length;
	const round = Math.floor(count / templates.length);
	const template = templates[templateIndex] ?? { title: "", caption: "" };
	// The offset per template keeps the same name off two neighbouring templates of one round.
	const slot = round + templateIndex * 3;
	// A studio post names an issue. Each round of templates covers one issue.
	const issue = FIRST_ISSUE + round;
	return {
		title: fill(template.title, slot, issue),
		caption: fill(template.caption, slot, issue),
		hashtags: [...HASHTAGS[pillar]],
	};
}
