// The search params of one project page: the open tab lives in the URL, as /app/projects/project-01?tab=board.
// The /app/projects/$projectId route validates the URL with this schema. The header alerts link to the board tab.
import { z } from "zod";

/** The tabs of a project page: the profile first, then the task board. */
export const projectTabSchema = z.enum(["overview", "board"]);

/** One tab id. */
export type ProjectTab = z.infer<typeof projectTabSchema>;

/** A missing or unknown tab opens the profile, so an old link still works. */
export const projectSearchSchema = z.object({
	tab: projectTabSchema.default("overview").catch("overview"),
});
