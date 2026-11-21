// The search params of the matter list: the status tab and the area filter live in the URL.
// The /app/matters route validates the URL with this schema, so a shared link opens the same cards.
import { z } from "zod";
import { PRACTICE_AREAS } from "~/features/practice";

/** The tabs of the matter list. "open" holds the four stages of work in progress. */
export const MATTER_STATUSES = ["open", "closed", "declined"] as const;

/** One tab of the matter list. */
export type MatterStatus = (typeof MATTER_STATUSES)[number];

/** `status` is absent for "open". `area` is absent for "All areas". An unknown value in the URL also reads as absent. */
export const mattersSearchSchema = z.object({
	status: z.enum(MATTER_STATUSES).optional().catch(undefined),
	area: z.enum(PRACTICE_AREAS).optional().catch(undefined),
});
