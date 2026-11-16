// The sample workspace of Vault: members, folders, files with their versions, outside contacts, and shares.
// workspace.ts reads it through readWorkspace(now); the queryFn of each api file calls that. No page imports this file.
// The rows start from the local midnight of today and come from a seeded generator, so they stay the same all day.
// All people, companies, and e-mail addresses are fictional. The .example domain is reserved for documentation.
import {
	type FileExtension,
	KIND_OF_EXTENSION,
	type ShareAccess,
	type Team,
} from "./codes";
import { addLocalDays, DAY_MS, MINUTE_MS } from "./time";

/** The plan of the workspace. Storage counts the current version of each file, also in the trash. */
export const WORKSPACE_PLAN = {
	/** Storage of the plan in bytes: 200 GB in decimal units. */
	storageBytes: 200_000_000_000,
	/** Member seats of the plan. */
	seats: 20,
	/** Days a deleted file stays in the trash before Vault deletes it for good. */
	trashRetentionDays: 30,
} as const;

/** One member of the team. `id` is the key that files, versions, and shares point to. */
export type MemberRow = {
	id: string;
	name: string;
	email: string;
	team: Team;
	/** An admin manages the plan and the trash of the whole workspace. */
	role: "admin" | "member";
};

/** One folder. `parentId` is null for a top folder of the workspace. The tree has two levels. */
export type FolderRow = {
	id: string;
	name: string;
	parentId: string | null;
	/** The team that owns the folder. New files in it belong to a member of this team. */
	team: Team;
};

/** One uploaded version of a file. Version 1 is the first upload. */
export type VersionRow = {
	number: number;
	/** ISO time of the upload. */
	uploadedAt: string;
	uploadedById: string;
	sizeBytes: number;
};

/** One file. The last version gives its size and its modified time. */
export type FileRow = {
	id: string;
	/** The full file name with its extension, as the uploader named it. */
	name: string;
	extension: FileExtension;
	/** null for a file at the top of the workspace. */
	folderId: string | null;
	ownerId: string;
	/** Oldest first. A file always has one version or more. */
	versions: VersionRow[];
	/** ISO time of the move to the trash, or null for a live file. */
	deletedAt: string | null;
	deletedById: string | null;
};

/** One person outside the team who receives shares: a client, a lawyer, a printer. */
export type ContactRow = {
	id: string;
	name: string;
	email: string;
	organization: string;
};

/** One share of a file: a public link, or an invitation to named contacts. */
export type ShareRow = {
	id: string;
	fileId: string;
	sharedById: string;
	/** ISO time of the share. */
	createdAt: string;
	/** "link": anyone with the link opens it. "people": only the invited contacts open it. */
	mode: "link" | "people";
	access: ShareAccess;
	/** The invited contacts. Empty for a link. */
	contactIds: string[];
	/** ISO time when the share stops working, or null for no end. */
	expiresAt: string | null;
	/** How many times the recipients opened the file. */
	views: number;
};

/** Every sample row of the workspace. readWorkspace(now) moves the events of today before now. */
export type SampleWorkspace = {
	members: MemberRow[];
	folders: FolderRow[];
	files: FileRow[];
	contacts: ContactRow[];
	shares: ShareRow[];
};

const MEMBERS: MemberRow[] = [
	member("m01", "Amara Lindqvist", "amara", "design"),
	member("m02", "Tobias Reyes", "tobias", "engineering"),
	member("m03", "Noor Haddad", "noor", "marketing"),
	member("m04", "Jonas Whitfield", "jonas", "engineering"),
	member("m05", "Priya Raman", "priya", "marketing"),
	member("m06", "Mateo Castell", "mateo", "sales"),
	member("m07", "Ines Moreau", "ines", "design"),
	member("m08", "Kwame Mensah", "kwame", "engineering"),
	{ ...member("m09", "Sofia Brandt", "sofia", "operations"), role: "admin" },
	member("m10", "Elliot Nakamura", "elliot", "marketing"),
	member("m11", "Leila Farouk", "leila", "sales"),
	member("m12", "Henrik Dahl", "henrik", "operations"),
	member("m13", "Yara Costa", "yara", "design"),
	member("m14", "Daniel Osei", "daniel", "engineering"),
];

function member(id: string, name: string, handle: string, team: Team) {
	return {
		id,
		name,
		email: `${handle}@team.example`,
		team,
		role: "member",
	} satisfies MemberRow;
}

const CONTACTS: ContactRow[] = [
	contact("c01", "Mira Okafor", "mira", "Lumen & Oak", "lumenoak"),
	contact("c02", "Callum Reid", "callum", "Lumen & Oak", "lumenoak"),
	contact("c03", "Hana Sato", "hana", "Brightwater Clinic", "brightwater"),
	contact(
		"c04",
		"Rafael Duarte",
		"rafael",
		"Brightwater Clinic",
		"brightwater",
	),
	contact("c05", "Greta Holm", "greta", "Atlas Freight", "atlasfreight"),
	contact("c06", "Omar Benali", "omar", "Atlas Freight", "atlasfreight"),
	contact("c07", "Lucia Ferraro", "lucia", "Fernhill Legal", "fernhill"),
	contact("c08", "Theo Marsh", "theo", "Quarry Print", "quarryprint"),
	contact("c09", "Aiko Tanaka", "aiko", "Northlight Films", "northlight"),
	contact("c10", "Samuel Price", "samuel", "Fernhill Legal", "fernhill"),
];

function contact(
	id: string,
	name: string,
	handle: string,
	organization: string,
	domain: string,
): ContactRow {
	return { id, name, email: `${handle}@${domain}.example`, organization };
}

const FOLDERS: FolderRow[] = [
	{ id: "brand", name: "Brand", parentId: null, team: "design" },
	{ id: "brand-logos", name: "Logos", parentId: "brand", team: "design" },
	{
		id: "brand-guidelines",
		name: "Guidelines",
		parentId: "brand",
		team: "design",
	},
	{
		id: "brand-photography",
		name: "Photography",
		parentId: "brand",
		team: "design",
	},
	{ id: "product", name: "Product", parentId: null, team: "design" },
	{ id: "product-specs", name: "Specs", parentId: "product", team: "design" },
	{
		id: "product-research",
		name: "Research",
		parentId: "product",
		team: "design",
	},
	{
		id: "product-screens",
		name: "Screens",
		parentId: "product",
		team: "design",
	},
	{
		id: "engineering",
		name: "Engineering",
		parentId: null,
		team: "engineering",
	},
	{
		id: "engineering-architecture",
		name: "Architecture",
		parentId: "engineering",
		team: "engineering",
	},
	{
		id: "engineering-releases",
		name: "Releases",
		parentId: "engineering",
		team: "engineering",
	},
	{
		id: "engineering-incidents",
		name: "Incident reviews",
		parentId: "engineering",
		team: "engineering",
	},
	{ id: "marketing", name: "Marketing", parentId: null, team: "marketing" },
	{
		id: "marketing-campaigns",
		name: "Campaigns",
		parentId: "marketing",
		team: "marketing",
	},
	{
		id: "marketing-social",
		name: "Social",
		parentId: "marketing",
		team: "marketing",
	},
	{
		id: "marketing-video",
		name: "Video",
		parentId: "marketing",
		team: "marketing",
	},
	{ id: "sales", name: "Sales", parentId: null, team: "sales" },
	{
		id: "sales-proposals",
		name: "Proposals",
		parentId: "sales",
		team: "sales",
	},
	{
		id: "sales-contracts",
		name: "Contracts",
		parentId: "sales",
		team: "sales",
	},
	{ id: "sales-decks", name: "Decks", parentId: "sales", team: "sales" },
	{ id: "clients", name: "Clients", parentId: null, team: "sales" },
	{
		id: "clients-lumen",
		name: "Lumen & Oak",
		parentId: "clients",
		team: "sales",
	},
	{
		id: "clients-brightwater",
		name: "Brightwater Clinic",
		parentId: "clients",
		team: "sales",
	},
	{
		id: "clients-atlas",
		name: "Atlas Freight",
		parentId: "clients",
		team: "sales",
	},
	{ id: "operations", name: "Operations", parentId: null, team: "operations" },
	{
		id: "operations-finance",
		name: "Finance",
		parentId: "operations",
		team: "operations",
	},
	{
		id: "operations-hiring",
		name: "Hiring",
		parentId: "operations",
		team: "operations",
	},
	{
		id: "operations-policies",
		name: "Policies",
		parentId: "operations",
		team: "operations",
	},
];

/** The contacts of each client folder. Shares of its files go to these people. */
const CLIENT_CONTACTS: Record<string, string[]> = {
	"clients-lumen": ["c01", "c02"],
	"clients-brightwater": ["c03", "c04"],
	"clients-atlas": ["c05", "c06"],
	"sales-contracts": ["c07", "c10"],
	"brand-logos": ["c08"],
	"brand-guidelines": ["c08"],
	"marketing-video": ["c09"],
};

/** Files that people named by hand, per folder id. "" is the top of the workspace. */
const NAMED_FILES: Record<string, string[]> = {
	"": [
		"Team handbook.pdf",
		"Holiday calendar 2026.xlsx",
		"Office floor plan.pdf",
	],
	"brand-logos": [
		"Logo primary.svg",
		"Logo primary dark.svg",
		"Logo mark.svg",
		"Logo lockup horizontal.ai",
		"Logo export pack.zip",
		"Favicon set.zip",
		"App icon master.psd",
		"Logo construction grid.fig",
	],
	"brand-guidelines": [
		"Brand guidelines 2026.pdf",
		"Brand guidelines source.fig",
		"Tone of voice.docx",
		"Color system.fig",
		"Typography specimen.pdf",
		"Iconography rules.md",
		"Email signatures.zip",
	],
	"brand-photography": ["Photo direction.pdf", "Shot list autumn.docx"],
	"product-specs": [
		"Sharing permissions spec.docx",
		"Upload queue spec.docx",
		"Search v2 spec.docx",
		"Offline mode one-pager.docx",
		"Storage quota alerts spec.md",
		"Link expiry rules.md",
		"Mobile file preview spec.docx",
	],
	"product-research": [
		"Research plan Q4.docx",
		"Persona board.fig",
		"Survey results October.xlsx",
		"Usability findings.pptx",
		"Market scan.pdf",
	],
	"product-screens": [
		"Web app screens.fig",
		"Mobile screens.fig",
		"Design tokens.json",
		"Component inventory.xlsx",
		"Icon set.fig",
		"Empty state illustrations.ai",
		"Onboarding flow.fig",
		"Settings redesign.fig",
	],
	"engineering-architecture": [
		"System overview.pdf",
		"Storage service design.docx",
		"Sync protocol notes.md",
		"Database schema.sql",
		"Event model.md",
		"API rate limits.yaml",
		"Threat model.docx",
		"Cost model.xlsx",
	],
	"engineering-releases": ["Release checklist.md"],
	"engineering-incidents": ["On-call runbook.md", "Postmortem outline.docx"],
	"marketing-campaigns": [
		"Autumn launch brief.docx",
		"Launch timeline.xlsx",
		"Landing page copy.docx",
		"Webinar deck.pptx",
		"Press kit.zip",
		"Customer story Atlas Freight.docx",
		"Newsletter November.docx",
		"Campaign results Q3.pptx",
	],
	"marketing-social": ["Social calendar Q4.xlsx", "Post layouts.fig"],
	"marketing-video": [
		"Product tour final.mp4",
		"Product tour script.docx",
		"Product tour raw footage.mov",
		"Explainer storyboard.pdf",
		"Voiceover take 3.wav",
		"Background track.mp3",
		"Customer interview cut.mov",
	],
	"sales-proposals": ["Proposal outline.docx", "Pricing table 2026.xlsx"],
	"sales-contracts": [
		"Master services agreement.pdf",
		"Data processing addendum.pdf",
		"Standard order form.docx",
		"Contract tracker.xlsx",
		"Mutual NDA.pdf",
		"Renewal terms 2026.docx",
	],
	"sales-decks": [
		"Sales deck 2026.pptx",
		"Pricing one-pager.pdf",
		"Security overview.pdf",
		"ROI calculator.xlsx",
		"Call talk track.docx",
		"Objection handling.md",
		"Case study pack.pdf",
	],
	"clients-lumen": [
		"Kickoff deck.pptx",
		"Statement of work.pdf",
		"Brand assets.zip",
		"Meeting notes.docx",
		"Project timeline.xlsx",
		"Feedback round 2.pdf",
	],
	"clients-brightwater": [
		"Rollout plan.docx",
		"Training session.mp4",
		"User list.csv",
		"Security questionnaire.xlsx",
		"Signed order form.pdf",
		"Onboarding deck.pptx",
	],
	"clients-atlas": [
		"Migration plan.docx",
		"Data export.zip",
		"Quarterly review.pptx",
		"Invoice schedule.xlsx",
		"Site photos.zip",
		"Renewal proposal.pdf",
	],
	"operations-finance": [
		"Budget 2027 draft.xlsx",
		"Board report Q3.pdf",
		"Vendor list.xlsx",
		"Tax filing checklist.md",
	],
	"operations-hiring": [
		"Hiring plan 2027.xlsx",
		"Designer job post.docx",
		"Engineer job post.docx",
		"Interview guide.pdf",
		"Standard offer letter.docx",
		"Onboarding checklist.md",
	],
	"operations-policies": [
		"Security policy.pdf",
		"Remote work policy.pdf",
		"Travel policy.pdf",
		"Data retention policy.docx",
		"Expense policy.pdf",
		"Code of conduct.pdf",
	],
};

/** Files in the trash: the name and the folder id that a restore puts them back in. */
const TRASHED_FILES: [name: string, folderId: string][] = [
	["Homepage hero (copy).fig", "product-screens"],
	["Untitled document.docx", "product-specs"],
	["Logo primary old.svg", "brand-logos"],
	["Screen recording 0412.mov", "product-research"],
	["Launch timeline v1.xlsx", "marketing-campaigns"],
	["Webinar rehearsal.mp4", "marketing-video"],
	["Pricing one-pager draft.pdf", "sales-decks"],
	["Proposal Kestrel Dental old.pdf", "sales-proposals"],
	["Brand assets (1).zip", "clients-lumen"],
	["Meeting notes copy.docx", "clients-lumen"],
	["User list old.csv", "clients-brightwater"],
	["Site photos raw.zip", "clients-atlas"],
	["Budget 2027 v0.xlsx", "operations-finance"],
	["Interview guide draft.docx", "operations-hiring"],
	["Old travel policy.pdf", "operations-policies"],
	["Debug logs.zip", "engineering-releases"],
	["Schema draft.sql", "engineering-architecture"],
	["Outage call recording.mp4", "engineering-incidents"],
	["Post layouts old.fig", "marketing-social"],
	["Story frames test.png", "marketing-social"],
	["Product tour cut 2.mov", "marketing-video"],
	["Persona board v1.fig", "product-research"],
	["Icon set backup.zip", "product-screens"],
	["Photo direction v1.pdf", "brand-photography"],
	["Unused shoot frames.zip", "brand-photography"],
	["Signature test.png", "brand-guidelines"],
];

/** Fictional prospects of the sales team. Proposal files name them. */
const PROSPECTS = [
	"Kestrel Dental",
	"Morrow Labs",
	"Pinecrest Hotels",
	"Saltmarsh Coffee",
	"Vireo Health",
	"Oakline Builders",
	"Tidewell Schools",
	"Juniper Analytics",
];

/** Screens of the product that the design team exports. Screen export files name them. */
const PRODUCT_SCREENS = [
	"Share dialog",
	"Upload queue",
	"File preview",
	"Folder picker",
	"Storage settings",
	"Link settings",
	"Search results",
	"Activity panel",
	"Trash view",
	"Onboarding step",
	"Version history",
];

/** Smallest and largest size in bytes per extension. A size is log-uniform between them. */
const SIZE_RANGES: Record<FileExtension, [number, number]> = {
	docx: [40e3, 2.4e6],
	md: [4e3, 60e3],
	pdf: [150e3, 18e6],
	xlsx: [30e3, 4e6],
	csv: [20e3, 30e6],
	pptx: [3e6, 90e6],
	png: [400e3, 9e6],
	jpg: [4e6, 22e6],
	svg: [4e3, 300e3],
	mp4: [300e6, 3.6e9],
	mov: [1.2e9, 7e9],
	fig: [8e6, 260e6],
	psd: [80e6, 1.4e9],
	ai: [4e6, 90e6],
	zip: [60e6, 2.8e9],
	json: [2e3, 800e3],
	yaml: [1e3, 40e3],
	sql: [10e3, 8e6],
	wav: [40e6, 400e6],
	mp3: [3e6, 20e6],
};

/** Most versions per kind of extension. Edited formats get many versions; exports get one. */
const MAX_VERSIONS: Record<FileExtension, number> = {
	docx: 7,
	md: 6,
	pdf: 2,
	xlsx: 8,
	csv: 2,
	pptx: 6,
	png: 1,
	jpg: 1,
	svg: 3,
	mp4: 2,
	mov: 1,
	fig: 10,
	psd: 4,
	ai: 4,
	zip: 1,
	json: 6,
	yaml: 5,
	sql: 5,
	wav: 3,
	mp3: 1,
};

// The oldest named file is about 14 months old. Recurring files cover the last 200 days.
const NAMED_MAX_AGE_DAYS = 420;
const RECURRING_DAYS = 200;

/** A seeded random generator (mulberry32). The same seed gives the same numbers on every render. */
function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

type Random = () => number;

function pick<Item>(random: Random, items: readonly Item[]): Item {
	const item = items[Math.floor(random() * items.length)];
	// SAFETY: every caller passes a list with one item or more, and the index is below its length.
	return item as Item;
}

function integerBetween(random: Random, min: number, max: number): number {
	return min + Math.floor(random() * (max - min + 1));
}

// A log-uniform size: small files are as likely as large ones on a log scale, like real folders.
function sizeOf(random: Random, extension: FileExtension): number {
	const [min, max] = SIZE_RANGES[extension];
	return Math.round(Math.exp(Math.log(min) + random() * Math.log(max / min)));
}

/** The extension of a sample file name. Every sample name ends with a known extension. */
function extensionOf(name: string): FileExtension {
	const extension = name.slice(name.lastIndexOf(".") + 1);
	if (!(extension in KIND_OF_EXTENSION)) {
		throw new Error(`Unknown extension in sample file "${name}"`);
	}
	// SAFETY: the `in` check above proves the key exists in KIND_OF_EXTENSION.
	return extension as FileExtension;
}

/** Builds the timestamps of one day `daysAgo` before today. */
function dayAt(todayStartMs: number, daysAgo: number) {
	const dayStartMs = addLocalDays(todayStartMs, -daysAgo);
	const weekday = new Date(dayStartMs).getDay();
	return {
		dayStartMs,
		// Saturday is 6 and Sunday is 0 in Date.getDay().
		isWeekend: weekday === 0 || weekday === 6,
		weekday,
		/** ISO time of `minutes` after the local midnight of that day. */
		at: (minutes: number) =>
			new Date(dayStartMs + minutes * MINUTE_MS).toISOString(),
	};
}

// Office hours from 08:30 to 19:00, in minutes after midnight. Most uploads happen then.
function workMinute(random: Random): number {
	return integerBetween(random, 8 * 60 + 30, 19 * 60);
}

// Named files are older on average: the age is skewed towards recent days, but some are over a year old.
function namedAgeDays(random: Random): number {
	return Math.floor(NAMED_MAX_AGE_DAYS * random() ** 1.7);
}

function membersOfTeam(team: Team): MemberRow[] {
	return MEMBERS.filter((row) => row.team === team);
}

function teamOfFolder(folderId: string | null): Team {
	return FOLDERS.find((folder) => folder.id === folderId)?.team ?? "operations";
}

/**
 * The versions of a new file. Version 1 lands `ageDays` before today; later versions land on later days,
 * at most 120 days after the first one. The uploader is the owner most of the time.
 */
function buildVersions(
	random: Random,
	todayStartMs: number,
	extension: FileExtension,
	ownerId: string,
	team: Team,
	ageDays: number,
	maxVersions: number,
): VersionRow[] {
	const count = Math.min(integerBetween(random, 1, maxVersions), ageDays + 1);
	const finalSize = sizeOf(random, extension);
	const span = Math.min(ageDays, 120);
	const laterAges = Array.from(
		{ length: count - 1 },
		() => ageDays - 1 - Math.floor(random() * span),
	)
		.map((age) => Math.max(age, 0))
		.sort((first, second) => second - first);
	const teamMembers = membersOfTeam(team);
	const uploadTimes = [ageDays, ...laterAges]
		.map((age) => {
			const day = dayAt(todayStartMs, age);
			// A weekend upload is rare: move it to the Friday before.
			const shift = day.isWeekend ? (day.weekday === 6 ? 1 : 2) : 0;
			return (shift > 0 ? dayAt(todayStartMs, age + shift) : day).at(
				workMinute(random),
			);
		})
		// The weekend move can swap two uploads, so the numbers follow the sorted times.
		.sort((first, second) => Date.parse(first) - Date.parse(second));
	return uploadTimes.map((uploadedAt, index) => {
		const isOwner = index === 0 || random() < 0.6;
		// Each version is a little smaller than the next one, so the last version is the largest.
		const growth = 0.82 + (0.18 * (index + 1)) / count;
		return {
			number: index + 1,
			uploadedAt,
			uploadedById: isOwner ? ownerId : pick(random, teamMembers).id,
			sizeBytes: Math.round(finalSize * growth),
		};
	});
}

/** One kind of file that the team makes again and again, for example an invoice on most work days. */
type RecurringSeries = {
	folderId: string | null;
	/** Chance of the series on one work day, from 0 to 1. Weekends have no recurring files. */
	chance: number;
	/** Count of files on a day that has the series. */
	countPerDay: [min: number, max: number];
	/** The days of the series. All work days (Monday to Friday) when absent. */
	isDay?: (date: Date) => boolean;
	/** The file name for the day, from the local date and the running number of the series. */
	name: (date: Date, sequence: number, indexInDay: number) => string;
};

function isoDate(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

// ISO 8601 week number: the week with the first Thursday of the year is week 1.
function isoWeek(date: Date): string {
	const thursday = new Date(date);
	thursday.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
	const firstThursday = new Date(thursday.getFullYear(), 0, 4);
	const week =
		1 +
		Math.round(
			((thursday.getTime() - firstThursday.getTime()) / DAY_MS -
				3 +
				((firstThursday.getDay() + 6) % 7)) /
				7,
		);
	return `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function twoDigits(value: number): string {
	return String(value).padStart(2, "0");
}

const RECURRING_SERIES: RecurringSeries[] = [
	{
		folderId: "brand-photography",
		chance: 0.07,
		countPerDay: [6, 14],
		name: (date, _sequence, index) =>
			`Shoot ${isoDate(date)} ${twoDigits(index + 1)}.jpg`,
	},
	{
		folderId: "product-research",
		chance: 0.08,
		countPerDay: [1, 1],
		name: (_date, sequence) => `Interview ${sequence} recording.mp4`,
	},
	{
		folderId: "product-research",
		chance: 0.08,
		countPerDay: [1, 1],
		name: (_date, sequence) => `Interview ${sequence} notes.docx`,
	},
	{
		folderId: "product-screens",
		chance: 0.35,
		countPerDay: [1, 3],
		// Each export names the screen it shows, so a grid of exports does not read as one name.
		name: (date, sequence) =>
			`${PRODUCT_SCREENS[sequence % PRODUCT_SCREENS.length]} ${isoDate(date)}.png`,
	},
	{
		folderId: "engineering-releases",
		chance: 1,
		countPerDay: [1, 1],
		// Releases ship on Thursday.
		isDay: (date) => date.getDay() === 4,
		name: (_date, sequence) => `Release notes 4.${sequence}.md`,
	},
	{
		folderId: "engineering-releases",
		chance: 0.5,
		countPerDay: [1, 1],
		name: (date) => `build-${isoDate(date).replaceAll("-", "")}.zip`,
	},
	{
		folderId: "engineering-incidents",
		chance: 0.04,
		countPerDay: [1, 1],
		name: (date) => `Incident review ${isoDate(date)}.docx`,
	},
	{
		folderId: "marketing-social",
		chance: 0.75,
		countPerDay: [1, 3],
		name: (date, _sequence, index) =>
			`Post ${isoDate(date)} ${String.fromCharCode(97 + index)}.png`,
	},
	{
		folderId: "marketing-video",
		chance: 0.12,
		countPerDay: [1, 1],
		name: (date) => `Clip ${isoDate(date)}.mp4`,
	},
	{
		folderId: "sales-proposals",
		chance: 0.28,
		countPerDay: [1, 1],
		name: (date, sequence) =>
			`Proposal ${PROSPECTS[sequence % PROSPECTS.length]} ${isoDate(date)}.pdf`,
	},
	{
		folderId: "operations-finance",
		chance: 0.55,
		countPerDay: [1, 2],
		name: (_date, sequence) => `Invoice INV-${2400 + sequence}.pdf`,
	},
	{
		folderId: "operations-finance",
		chance: 1,
		countPerDay: [1, 1],
		// The first Monday of each month gets the expense report of the month before.
		isDay: (date) => date.getDay() === 1 && date.getDate() <= 7,
		name: (date) => {
			const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
			return `Expenses ${previous.getFullYear()}-${twoDigits(previous.getMonth() + 1)}.xlsx`;
		},
	},
	{
		folderId: "operations",
		chance: 1,
		countPerDay: [1, 1],
		isDay: (date) => date.getDay() === 1,
		name: (date) => `Weekly metrics ${isoWeek(date)}.xlsx`,
	},
	{
		folderId: "operations",
		chance: 1,
		countPerDay: [1, 1],
		// The all-hands meeting is on the last Friday of the month: the Friday a week later is in the next month.
		isDay: (date) =>
			date.getDay() === 5 &&
			new Date(
				date.getFullYear(),
				date.getMonth(),
				date.getDate() + 7,
			).getMonth() !== date.getMonth(),
		name: (date) => `All-hands ${isoDate(date)}.mp4`,
	},
	{
		folderId: "operations-hiring",
		chance: 0.15,
		countPerDay: [1, 1],
		name: (_date, sequence) => `Interview scorecard ${sequence}.docx`,
	},
];

/** Fixed seed of the generator. Change it to get another workspace with the same shape. */
const SEED = 20_261_114;

/**
 * Every sample row of the workspace, built from the local midnight of today (`todayStartMs`).
 * The same day gives the same rows. An event of today can be later than now: readWorkspace moves it before now.
 */
export function buildSampleWorkspace(todayStartMs: number): SampleWorkspace {
	const random = createRandom(SEED);
	const files: FileRow[] = [];
	let fileSequence = 0;
	const nextFileId = () => {
		fileSequence += 1;
		return `file-${String(fileSequence).padStart(4, "0")}`;
	};

	for (const [folderKey, names] of Object.entries(NAMED_FILES)) {
		const folderId = folderKey === "" ? null : folderKey;
		const team = teamOfFolder(folderId);
		for (const name of names) {
			const extension = extensionOf(name);
			const ownerId = pick(random, membersOfTeam(team)).id;
			files.push({
				id: nextFileId(),
				name,
				extension,
				folderId,
				ownerId,
				versions: buildVersions(
					random,
					todayStartMs,
					extension,
					ownerId,
					team,
					namedAgeDays(random),
					MAX_VERSIONS[extension],
				),
				deletedAt: null,
				deletedById: null,
			});
		}
	}

	// Shares go to hand-named deliverables and proposals, not to the daily photos, posts, or builds.
	const shareCandidates = [...files];

	RECURRING_SERIES.forEach((series, seriesIndex) => {
		const team = teamOfFolder(series.folderId);
		const seriesRandom = createRandom(SEED + seriesIndex * 7919);
		let sequence = 0;
		// Oldest day first, so the running numbers grow with the date.
		for (let daysAgo = RECURRING_DAYS; daysAgo >= 0; daysAgo -= 1) {
			const day = dayAt(todayStartMs, daysAgo);
			const date = new Date(day.dayStartMs);
			const isPlanned = series.isDay ? series.isDay(date) : !day.isWeekend;
			// The draw happens on every day, so a change of one series day does not move the others.
			const draw = seriesRandom();
			if (!isPlanned || draw >= series.chance) {
				continue;
			}
			const count = integerBetween(seriesRandom, ...series.countPerDay);
			const minute = workMinute(seriesRandom);
			for (let index = 0; index < count; index += 1) {
				sequence += 1;
				const name = series.name(date, sequence, index);
				const extension = extensionOf(name);
				const ownerId = pick(seriesRandom, membersOfTeam(team)).id;
				const file: FileRow = {
					id: nextFileId(),
					name,
					extension,
					folderId: series.folderId,
					ownerId,
					versions: [
						{
							number: 1,
							// The files of one day arrive a few minutes apart, like one batch upload.
							uploadedAt: day.at(Math.min(minute + index * 2, 23 * 60)),
							uploadedById: ownerId,
							sizeBytes: sizeOf(seriesRandom, extension),
						},
					],
					deletedAt: null,
					deletedById: null,
				};
				files.push(file);
				// One proposal in three goes out by link, so the Shared page is not a list of proposals.
				if (series.folderId === "sales-proposals" && sequence % 3 === 0) {
					shareCandidates.push(file);
				}
			}
		}
	});

	const trashRandom = createRandom(SEED + 101);
	for (const [name, folderId] of TRASHED_FILES) {
		const extension = extensionOf(name);
		const team = teamOfFolder(folderId);
		const ownerId = pick(trashRandom, membersOfTeam(team)).id;
		const deletedDaysAgo = integerBetween(
			trashRandom,
			0,
			WORKSPACE_PLAN.trashRetentionDays - 1,
		);
		const ageDays = deletedDaysAgo + integerBetween(trashRandom, 3, 160);
		const versions = buildVersions(
			trashRandom,
			todayStartMs,
			extension,
			ownerId,
			team,
			ageDays,
			// A trashed file keeps its versions until the last one before the delete.
			Math.min(MAX_VERSIONS[extension], 3),
		).filter(
			(version) =>
				Date.parse(version.uploadedAt) <
				addLocalDays(todayStartMs, -deletedDaysAgo),
		);
		const deletedDay = dayAt(todayStartMs, deletedDaysAgo);
		files.push({
			id: nextFileId(),
			name,
			extension,
			folderId,
			ownerId,
			versions,
			deletedAt: deletedDay.at(workMinute(trashRandom)),
			deletedById:
				trashRandom() < 0.7 ? ownerId : pick(trashRandom, MEMBERS).id,
		});
	}

	return {
		members: MEMBERS,
		folders: FOLDERS,
		files: files.filter((file) => file.versions.length > 0),
		contacts: CONTACTS,
		shares: buildShares(
			createRandom(SEED + 202),
			todayStartMs,
			shareCandidates,
		),
	};
}

// Share links of these kinds go to clients and partners. Code and raw design files stay inside the team.
const SHAREABLE_EXTENSIONS: FileExtension[] = [
	"pdf",
	"pptx",
	"docx",
	"xlsx",
	"mp4",
	"mov",
	"zip",
	"png",
	"jpg",
	"svg",
	"ai",
	"fig",
];

// Days until a share ends. null is a share with no end date.
const LINK_EXPIRY_DAYS = [7, 14, 30, null] as const;
const PEOPLE_EXPIRY_DAYS = [30, 90, null, null] as const;

// About 70 shares over the last 120 days.
const SHARE_COUNT = 70;
const SHARE_WINDOW_DAYS = 120;

function buildShares(
	random: Random,
	todayStartMs: number,
	files: FileRow[],
): ShareRow[] {
	const candidates = files.filter(
		(file) =>
			file.deletedAt === null &&
			SHAREABLE_EXTENSIONS.includes(file.extension) &&
			file.folderId !== null &&
			!file.folderId.startsWith("engineering") &&
			!file.folderId.startsWith("operations"),
	);
	const shares: ShareRow[] = [];
	const usedFileIds = new Set<string>();
	for (
		let attempt = 0;
		shares.length < SHARE_COUNT && attempt < 600;
		attempt++
	) {
		const file = pick(random, candidates);
		const firstUpload = file.versions[0];
		if (usedFileIds.has(file.id) || !firstUpload) {
			continue;
		}
		const fileAgeDays = Math.round(
			(todayStartMs - Date.parse(firstUpload.uploadedAt)) / DAY_MS,
		);
		// A share needs a file that existed a full day before it.
		if (fileAgeDays < 1) {
			continue;
		}
		usedFileIds.add(file.id);
		const shareAgeDays = Math.floor(
			random() * Math.min(fileAgeDays, SHARE_WINDOW_DAYS),
		);
		const day = dayAt(todayStartMs, shareAgeDays);
		const createdAtMs = Date.parse(day.at(workMinute(random)));
		const folderContacts = CLIENT_CONTACTS[file.folderId ?? ""];
		// Client and partner folders mostly go to their own contacts. Other folders use public links only.
		const contactIds =
			folderContacts && random() < 0.8
				? folderContacts.slice(
						0,
						integerBetween(random, 1, folderContacts.length),
					)
				: [];
		const mode: ShareRow["mode"] = contactIds.length > 0 ? "people" : "link";
		const expiryDays =
			mode === "link"
				? pick(random, LINK_EXPIRY_DAYS)
				: pick(random, PEOPLE_EXPIRY_DAYS);
		const access: ShareAccess =
			mode === "link"
				? random() < 0.8
					? "view"
					: "comment"
				: pick(random, ["view", "comment", "edit"] as const);
		// Views grow with the age of the share. A link reaches more people than an invitation.
		const reach = mode === "link" ? 40 : 9;
		shares.push({
			id: `share-${String(shares.length + 1).padStart(3, "0")}`,
			fileId: file.id,
			sharedById: pick(random, membersOfTeam(teamOfFolder(file.folderId))).id,
			createdAt: new Date(createdAtMs).toISOString(),
			mode,
			access,
			contactIds,
			expiresAt:
				expiryDays === null
					? null
					: new Date(
							addLocalDays(createdAtMs, expiryDays) +
								(createdAtMs - day.dayStartMs),
						).toISOString(),
			views: Math.floor(random() * reach * Math.sqrt(shareAgeDays + 1)),
		});
	}
	return shares;
}
