// The search params of the home: the open tab and the period live in the URL, as /app?tab=reports&days=90.
// The /app route validates the URL with this schema. OverviewPage writes both with navigate().
import { z } from "zod";
import { periodDaysSchema } from "~/features/studio";

/** The tabs of the home: the dashboard bands, then the project budget report. */
export const overviewTabSchema = z.enum(["overview", "reports"]);

/** One tab id. */
export type OverviewTab = z.infer<typeof overviewTabSchema>;

/** A missing or unknown value opens the overview of 30 days, so an old shared link still works. */
export const overviewSearchSchema = z.object({
	tab: overviewTabSchema.default("overview").catch("overview"),
	days: periodDaysSchema,
});
