// The search params of the home: the open tab lives in the URL, as /app?tab=reports.
// The /app route validates the URL with this schema.
import { z } from "zod";

/** The tabs of the home: the dashboard first, then the project report. */
export const overviewTabSchema = z.enum(["overview", "reports"]);

/** One tab id. */
export type OverviewTab = z.infer<typeof overviewTabSchema>;

/** A missing or unknown tab opens the dashboard, so an old link with ?tab=tasks still works. */
export const overviewSearchSchema = z.object({
	tab: overviewTabSchema.default("overview").catch("overview"),
});
