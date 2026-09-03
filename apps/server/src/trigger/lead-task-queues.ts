import { type Queue, queue } from "@trigger.dev/sdk";

/** Only one Google Sheets due-project sweep may consume write quota at a time. */
export const leadSheetAutoSyncQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "lead-sheet-auto-sync",
});
