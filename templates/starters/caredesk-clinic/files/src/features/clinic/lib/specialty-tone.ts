// One chart color per department of the practice, so a department has the same color on every page.
// The calendar chips, the department chart, and the calendar legend read it.
// The classes are written in full, because Tailwind only builds the class names that it finds in the code.
import type { Specialty } from "./sample-practitioners";

/** The classes and the CSS color of one department. */
export type SpecialtyTone = {
	/** A solid dot or bar segment, for example "bg-chart-1". */
	dot: string;
	/** A soft fill for an event chip, 15 % of the chart color. */
	soft: string;
	/** The CSS color for a chart config, for example "var(--chart-1)". */
	color: string;
};

/** Chart series 1 to 5 in the order of SPECIALTIES. */
export const SPECIALTY_TONE = {
	general_practice: {
		dot: "bg-chart-1",
		soft: "bg-chart-1/15",
		color: "var(--chart-1)",
	},
	pediatrics: {
		dot: "bg-chart-2",
		soft: "bg-chart-2/15",
		color: "var(--chart-2)",
	},
	dermatology: {
		dot: "bg-chart-3",
		soft: "bg-chart-3/15",
		color: "var(--chart-3)",
	},
	physiotherapy: {
		dot: "bg-chart-4",
		soft: "bg-chart-4/15",
		color: "var(--chart-4)",
	},
	nursing: {
		dot: "bg-chart-5",
		soft: "bg-chart-5/15",
		color: "var(--chart-5)",
	},
} satisfies Record<Specialty, SpecialtyTone>;
