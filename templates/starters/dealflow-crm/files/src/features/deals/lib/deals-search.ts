// The search params of the deal list: the stage tab lives in the URL, as /app/deals?stage=proposal.
// The /app/deals route validates the URL with this schema. The board links to a stage with it.
import { z } from "zod";
import { DEAL_STAGES } from "~/features/crm";

/** `stage` is absent for the "All" tab. An unknown value in the URL also reads as absent. */
export const dealsSearchSchema = z.object({
	stage: z.enum(DEAL_STAGES).optional().catch(undefined),
});
