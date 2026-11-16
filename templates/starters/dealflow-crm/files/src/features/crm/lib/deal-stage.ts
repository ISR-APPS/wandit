// The fixed lists of a deal: its stages in the order of the sales work, its sources, and its lost reasons.
// The sample tables, the pipeline board, the deal pages, and the stage badge read this file.
// A later database keeps the same values in the check constraints of the deals table.

/** Every stage. A deal moves from lead to negotiation, then ends as won or lost. */
export const DEAL_STAGES = [
	"lead",
	"qualified",
	"proposal",
	"negotiation",
	"won",
	"lost",
] as const;

/** One stage. Its label is the message key `stages.<stage>`. */
export type DealStage = (typeof DEAL_STAGES)[number];

/** The stages of an open deal, in order. The weighted forecast and the open counts read only these. */
export const OPEN_STAGES = [
	"lead",
	"qualified",
	"proposal",
	"negotiation",
] as const satisfies readonly DealStage[];

/** One stage of an open deal. */
export type OpenStage = (typeof OPEN_STAGES)[number];

/** The stages of a deal that ends well. The board draws one column for each, and the stage path one step. */
export const WINNING_PATH = [
	...OPEN_STAGES,
	"won",
] as const satisfies readonly DealStage[];

/** Chance to win from each stage, as a ratio. The weighted forecast is the amount times this value. */
export const STAGE_PROBABILITY = {
	lead: 0.1,
	qualified: 0.3,
	proposal: 0.6,
	negotiation: 0.8,
	won: 1,
	lost: 0,
} as const satisfies Record<DealStage, number>;

/** Days in one stage after which an open deal counts as stalled. The board and the lists flag it. */
export const STALLED_AFTER_DAYS = 14;

/** True for lead, qualified, proposal, and negotiation. It narrows the stage for STAGE maps of open deals. */
export function isOpenStage(stage: DealStage): stage is OpenStage {
	return stage !== "won" && stage !== "lost";
}

/** Where a deal comes from. Its label is the message key `deals.sources.<source>`. */
export const DEAL_SOURCES = [
	"inbound",
	"outbound",
	"referral",
	"event",
	"partner",
] as const;

/** One source of a deal. */
export type DealSource = (typeof DEAL_SOURCES)[number];

/** Why a deal was lost. Its label is the message key `deals.lostReasons.<reason>`. */
export const LOST_REASONS = [
	"price",
	"timing",
	"competitor",
	"no_budget",
	"no_decision",
] as const;

/** One reason of a lost deal. */
export type LostReason = (typeof LOST_REASONS)[number];
