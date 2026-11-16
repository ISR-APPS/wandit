// The search params of the project list: the status tab lives in the URL, as /app/projects?status=paused.
// The /app/projects route validates the URL with this schema.
import { z } from "zod";
import { PROJECT_STATUSES } from "~/features/tracker";

/** `status` is absent for the "All" tab. An unknown value in the URL also reads as absent. */
export const projectsSearchSchema = z.object({
	status: z.enum(PROJECT_STATUSES).optional().catch(undefined),
});
