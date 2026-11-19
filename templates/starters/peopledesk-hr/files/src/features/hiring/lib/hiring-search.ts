// The search params of the hiring page: the position filter and the open candidate live in the URL,
// as /app/hiring?position=REQ-118&candidate=CA-5120. The /app/hiring route validates the URL with this schema.
// The alerts of the header link to a candidate with it.
import { z } from "zod";

/** Both keys are optional. No position, or an unknown one, shows every position; an unknown candidate keeps the dialog closed. */
export const hiringSearchSchema = z.object({
	position: z.string().max(40).optional().catch(undefined),
	candidate: z.string().max(40).optional().catch(undefined),
});
