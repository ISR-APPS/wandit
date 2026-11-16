// The fill class of each board stage, for the pipeline bar of a position card and the column marks of the board.
// From a light tint of the primary for a new application to the success token for a hire.
import type { BoardStage } from "../api/hiring.queries";

/** Tailwind fill per board stage. Darker means further in the pipeline. */
export const STAGE_FILL = {
	applied: "bg-primary/20",
	screening: "bg-primary/40",
	interview: "bg-primary/65",
	offer: "bg-primary/85",
	hired: "bg-success",
} satisfies Record<BoardStage, string>;
