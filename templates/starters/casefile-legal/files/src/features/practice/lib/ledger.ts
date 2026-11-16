// The money and the hours of each matter: logged time, unbilled time, billed, paid, and overdue amounts.
// The matter list, the matter detail page, and the client pages read these totals, so every page agrees.
// It is pure math over the sample tables. A later database computes the same sums in a SQL view.
import { toTenths } from "./format";
import type { SampleTables } from "./sample-data";

/** The totals of one matter. Amounts are whole USD, hours have one decimal. */
export type MatterLedger = {
	/** Every logged hour, billable or not. */
	hours: number;
	/** Billable time that no invoice charges yet. */
	unbilled: number;
	/** The sum of the invoices. */
	billed: number;
	/** The sum of the payments. */
	paid: number;
	/** billed minus paid. */
	outstanding: number;
	/** The open balance of the invoices past their due date. Part of outstanding. */
	overdue: number;
};

const EMPTY_LEDGER: MatterLedger = {
	hours: 0,
	unbilled: 0,
	billed: 0,
	paid: 0,
	outstanding: 0,
	overdue: 0,
};

/** One ledger per matter id. A matter with no entry and no invoice gets zeros. */
export function buildMatterLedgers(
	tables: SampleTables,
): Map<string, MatterLedger> {
	const ledgers = new Map(
		tables.matters.map((matter) => [matter.id, { ...EMPTY_LEDGER }]),
	);
	for (const entry of tables.timeEntries) {
		const ledger = ledgers.get(entry.matterId);
		if (!ledger) {
			continue;
		}
		ledger.hours += entry.hours;
		if (entry.billable && entry.invoiceId === null) {
			ledger.unbilled += entry.amount;
		}
	}
	for (const invoice of tables.invoices) {
		const ledger = ledgers.get(invoice.matterId);
		if (!ledger) {
			continue;
		}
		ledger.billed += invoice.amount;
		ledger.paid += invoice.paidAmount;
		if (invoice.status === "overdue") {
			ledger.overdue += invoice.amount - invoice.paidAmount;
		}
	}
	for (const ledger of ledgers.values()) {
		ledger.hours = toTenths(ledger.hours);
		ledger.outstanding = ledger.billed - ledger.paid;
	}
	return ledgers;
}

/** The ledger of one matter, or zeros when the id has none. */
export function ledgerOf(
	ledgers: Map<string, MatterLedger>,
	matterId: string,
): MatterLedger {
	return ledgers.get(matterId) ?? EMPTY_LEDGER;
}
