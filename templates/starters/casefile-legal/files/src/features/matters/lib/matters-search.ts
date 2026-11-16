// The search params of the matter list: the stage tab and the area filter live in the URL.
// The /app/matters route validates the URL with this schema. The board links to one stage with it.
import { z } from "zod";
import { MATTER_STAGES, PRACTICE_AREAS } from "~/features/practice";

/** `stage` and `area` are absent for "All". An unknown value in the URL also reads as absent. */
export const mattersSearchSchema = z.object({
	stage: z.enum(MATTER_STAGES).optional().catch(undefined),
	area: z.enum(PRACTICE_AREAS).optional().catch(undefined),
});
