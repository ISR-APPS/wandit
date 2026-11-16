// The search params of the hiring page: the chosen position and the open candidate live in the URL,
// as /app/hiring?position=REQ-118&candidate=CA-5120. The /app/hiring route validates the URL with this schema.
// The overview links to a candidate with it.
import { z } from "zod";

/** Both keys are optional. No position shows the first open one; an unknown candidate keeps the dialog closed. */
export const hiringSearchSchema = z.object({
	position: z.string().max(40).optional().catch(undefined),
	candidate: z.string().max(40).optional().catch(undefined),
});
