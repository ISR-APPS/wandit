// The search params of the Activity page: the open transaction lives in the URL, as /app/activity?tx=tx-0042.
// The /app/activity route validates the URL with this schema. The home links to one transaction with it.
import { z } from "zod";

/** `tx` is the id of the transaction in the side panel. Absent: the panel is closed. An unknown id shows no panel. */
export const activitySearchSchema = z.object({
	tx: z.string().max(40).optional().catch(undefined),
});
