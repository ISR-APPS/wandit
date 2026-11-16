// The search params of the Assignments page: the open submission lives in the URL, as /app/assignments?submission=sub-0412.
// The /app/assignments route validates the URL with this schema. The home links to one submission with it.
import { z } from "zod";

/** `submission` is absent while the side panel is closed. A value that is not a text reads as absent. */
export const assignmentsSearchSchema = z.object({
	submission: z.string().max(40).optional().catch(undefined),
});
