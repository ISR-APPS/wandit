// The search params of the overview: the open tab lives in the URL, as /app?tab=bugs.
// The /app route validates the URL with this schema. The entity rows link to a tab with it.
import { z } from "zod";

/** The tabs of the overview: the summary first, then one tab per entity. */
export const overviewTabSchema = z.enum(["overview", "tasks", "bugs"]);

/** One tab id. */
export type OverviewTab = z.infer<typeof overviewTabSchema>;

/** A missing or unknown tab opens the overview, so an old shared link still works. */
export const overviewSearchSchema = z.object({
	tab: overviewTabSchema.default("overview").catch("overview"),
});
