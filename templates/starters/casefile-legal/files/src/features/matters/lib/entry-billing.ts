// The billing state of a time entry, from its billable flag and its invoice.
// The recent entries card and the time entries table of the matter page read it, so both show the same word.
import type { TimeEntryRow } from "~/features/practice";

/** "billed": an invoice charges it. "unbilled": billable and waiting for an invoice. "notBillable": recorded only. */
export type EntryBillingState = "billed" | "unbilled" | "notBillable";

/** The state of one entry. A flat-fee or declined matter logs entries that are not billable. */
export function entryBillingState(
	entry: Pick<TimeEntryRow, "billable" | "invoiceId">,
): EntryBillingState {
	if (!entry.billable) {
		return "notBillable";
	}
	return entry.invoiceId === null ? "unbilled" : "billed";
}

/** Badge variant per billing state. Unbilled is amber: that work still waits for an invoice. The word always shows. */
export const ENTRY_STATE_BADGE = {
	billed: "success",
	unbilled: "warning",
	notBillable: "outline",
} as const satisfies Record<EntryBillingState, string>;
