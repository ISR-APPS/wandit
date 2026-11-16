// The six projects of the index, in ledger order. The index, the case study, and the wall read this list.
// Each text of a project is in the message group `projects.<id>` of src/shared/i18n/messages.ts.
// To make the list real, replace it with rows of a `projects` table (see STARTER.md).

/** The id of a project. It is also the key of its message group. */
export type ProjectId =
	| "mellah"
	| "sirocco"
	| "warqa"
	| "casbah"
	| "nedjma"
	| "sahar";

/** How a cover is composed. landing.css draws each recipe from the plate width. */
export type PlateRecipe = "name" | "letter" | "stack" | "point";

/** The color pair of a cover: ultramarine, ink, or sand, each with its type color, or paper with a frame. */
export type PlateTone = "ultra" | "ink" | "sand" | "paper";

/** One row of the index. */
export type Project = {
	id: ProjectId;
	/** Two digits of the ledger number, for example "01". Not translated. */
	number: string;
	/** Delivery year, four digits. Not translated. */
	year: string;
	/** The id of the element that the row opens: the case study, or the cover on the wall. */
	targetId: string;
	/** The typographic cover of the project. No two neighbours on the wall share a recipe and a tone. */
	plate: { recipe: PlateRecipe; tone: PlateTone };
};

/** The project of the case study: the first row of the index. */
export const CASE_PROJECT: Project = {
	id: "mellah",
	number: "01",
	year: "2025",
	targetId: "case",
	plate: { recipe: "name", tone: "ultra" },
};

/** The index, in ledger order. */
export const PROJECTS: readonly Project[] = [
	CASE_PROJECT,
	{
		id: "sirocco",
		number: "02",
		year: "2025",
		targetId: "cover-sirocco",
		plate: { recipe: "letter", tone: "ink" },
	},
	{
		id: "warqa",
		number: "03",
		year: "2024",
		targetId: "cover-warqa",
		plate: { recipe: "stack", tone: "paper" },
	},
	{
		id: "casbah",
		number: "04",
		year: "2024",
		targetId: "cover-casbah",
		plate: { recipe: "point", tone: "ultra" },
	},
	{
		id: "nedjma",
		number: "05",
		year: "2023",
		targetId: "cover-nedjma",
		plate: { recipe: "name", tone: "sand" },
	},
	{
		id: "sahar",
		number: "06",
		year: "2023",
		targetId: "cover-sahar",
		plate: { recipe: "stack", tone: "ink" },
	},
];
