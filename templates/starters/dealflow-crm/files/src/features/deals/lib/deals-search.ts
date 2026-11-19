// The search params of the Deals page: the view and the stage tab live in the URL, as /app/deals?view=table&stage=proposal.
// The /app/deals route validates the URL with this schema. The board columns link to a stage of the table with it.
import { z } from "zod";
import { DEAL_STAGES } from "~/features/crm";

/** The two views of the Deals page: the stage board and the table. */
export const DEAL_VIEWS = ["board", "table"] as const;

/** `view` is absent for the board. `stage` is absent for the "All" tab. An unknown value in the URL reads as absent. */
export const dealsSearchSchema = z.object({
	view: z.enum(DEAL_VIEWS).optional().catch(undefined),
	stage: z.enum(DEAL_STAGES).optional().catch(undefined),
});
