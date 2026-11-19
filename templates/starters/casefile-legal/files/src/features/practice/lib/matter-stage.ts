// The stages of a matter, the practice areas, and the dot color of each stage.
// The dashboard, the matter list and detail pages, and the client sheet read this file.
// A later database keeps the same values in a check constraint of the matters table.

/** Every stage. The four open stages come in the order of the work. "declined" ends a matter at intake. */
export const MATTER_STAGES = [
	"intake",
	"research",
	"drafting",
	"negotiation",
	"closed",
	"declined",
] as const;

/** One stage. Its label is the message key `stages.<stage>`. */
export type MatterStage = (typeof MATTER_STAGES)[number];

// The stages of a matter that is still in work, in order.
const OPEN_STAGES = [
	"intake",
	"research",
	"drafting",
	"negotiation",
] as const satisfies readonly MatterStage[];

/** The path of a matter from intake to closed. The stage pipeline and the progress bars count the steps on it. */
export const STAGE_PATH = [
	...OPEN_STAGES,
	"closed",
] as const satisfies readonly MatterStage[];

/** True while the matter is in one of the four open stages. */
export function isOpenStage(stage: MatterStage): boolean {
	return OPEN_STAGES.some((open) => open === stage);
}

/**
 * Dot color of each stage in the stage pipeline of the dashboard and in the stage badge. The word always sits beside it.
 * Research is pale ink and drafting is deep ink, so the two blue stages differ in lightness.
 * Negotiation needs action soon; declined is a closed record with no result.
 */
export const MATTER_STAGE_DOT = {
	intake: "bg-muted-foreground",
	research: "bg-chart-3",
	drafting: "bg-primary",
	negotiation: "bg-warning",
	closed: "bg-success",
	declined: "bg-border",
} satisfies Record<MatterStage, string>;

/**
 * A deadline this many calendar days ahead or less needs attention. deadlinePriority gives it "medium" or "high".
 * A week gives the team time to prepare a filing or a hearing.
 */
export const DEADLINE_SOON_DAYS = 7;

/** The practice areas of the firm. The label is the message key `areas.<area>`. */
export const PRACTICE_AREAS = [
	"litigation",
	"corporate",
	"employment",
	"real_estate",
	"family",
	"estates",
	"ip",
] as const;

/** One practice area. */
export type PracticeArea = (typeof PRACTICE_AREAS)[number];

/**
 * The step of a stage on STAGE_PATH: 1 for intake to 5 for closed. The progress bars of the matter cards
 * and of the active matters table read it. null for "declined": that matter leaves the path at intake.
 */
export function stageStep(stage: MatterStage): number | null {
	// Every stage except "declined" is on STAGE_PATH, so indexOf finds it.
	return stage === "declined" ? null : STAGE_PATH.indexOf(stage) + 1;
}
