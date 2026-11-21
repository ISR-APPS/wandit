// The search params of the transactions page: the tab lives in the URL, as /app/transactions?tab=upcoming.
// The /app/transactions route validates the URL with this schema. The home banner links to the Upcoming tab with it.
import { z } from "zod";

/** "latest": posted and returned entries. "upcoming": pending entries that post in 1 to 3 bank days. */
export const ENTRY_TABS = ["latest", "upcoming"] as const;

/** One tab of the transactions page. */
export type EntryTab = (typeof ENTRY_TABS)[number];

/** `tab` is absent for "latest". An unknown value in the URL reads as absent. */
export const transactionsSearchSchema = z.object({
	tab: z.enum(ENTRY_TABS).optional().catch(undefined),
});
