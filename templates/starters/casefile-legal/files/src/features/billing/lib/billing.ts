// The math of the billing page: hours per day, hours by practice area, the invoice list, the totals,
// and the file of one invoice. billing.queries.ts calls these functions in its queryFn.
// It is pure: every function takes the rows and "now", so a later SQL function gives the same numbers.
import {
	type AttorneyRole,
	addLocalDays,
	type BreakdownSlice,
	buildDailySeries,
	type DailyPoint,
	dayKeyOf,
	type InvoiceRow,
	type PaymentRow,
	PRACTICE_AREAS,
	type PracticeArea,
	type SampleTables,
	startOfLocalDay,
	toTenths,
} from "~/features/practice";

/** The period of the breakdown, of the collected total, and of the first trend view. */
export const BILLING_DAYS = 30;

/** Logged hours per local day for the last `days` days, with the same days one period earlier. */
export function hoursPerDay(
	tables: SampleTables,
	days: number,
	now: number,
): DailyPoint[] {
	const hoursByDay = new Map<string, number>();
	for (const entry of tables.timeEntries) {
		hoursByDay.set(entry.day, (hoursByDay.get(entry.day) ?? 0) + entry.hours);
	}
	return buildDailySeries(days, now, hoursByDay).map((point) => ({
		...point,
		current: toTenths(point.current),
		previous: toTenths(point.previous),
	}));
}

/** One part of the hours breakdown. `label` is an area code, or "other" for the sum of the smaller areas. */
export type AreaSlice = BreakdownSlice & { label: PracticeArea | "other" };

// The skill rule for a breakdown: 2 to 5 parts, then one "Other" part.
const MAX_AREA_SLICES = 5;

/**
 * Logged hours by practice area in the last `days` days, the largest first. Areas with no hours are left out.
 * The areas after the fifth go into one "other" slice at the end.
 */
export function hoursByArea(
	tables: SampleTables,
	days: number,
	now: number,
): AreaSlice[] {
	const firstDay = dayKeyOf(addLocalDays(startOfLocalDay(now), -(days - 1)));
	const areaOf = new Map(
		tables.matters.map((matter) => [matter.id, matter.area]),
	);
	const hoursOfArea = new Map<PracticeArea, number>(
		PRACTICE_AREAS.map((area) => [area, 0]),
	);
	for (const entry of tables.timeEntries) {
		const area = areaOf.get(entry.matterId);
		// Day keys are YYYY-MM-DD, so a text compare is a date compare.
		if (area && entry.day >= firstDay) {
			hoursOfArea.set(area, (hoursOfArea.get(area) ?? 0) + entry.hours);
		}
	}
	const ranked: AreaSlice[] = [...hoursOfArea.entries()]
		.filter(([, hours]) => hours > 0)
		.sort((first, second) => second[1] - first[1])
		.map(([area, hours]) => ({ label: area, value: toTenths(hours) }));
	if (ranked.length <= MAX_AREA_SLICES) {
		return ranked;
	}
	const rest = ranked.slice(MAX_AREA_SLICES);
	return [
		...ranked.slice(0, MAX_AREA_SLICES),
		{
			label: "other",
			value: toTenths(rest.reduce((sum, slice) => sum + slice.value, 0)),
		},
	];
}

/** One invoice with the names of its client and matter. */
export type InvoiceListItem = InvoiceRow & {
	clientName: string;
	matterName: string;
	matterNumber: string;
};

/** Every invoice, newest first. */
export function buildInvoiceList(tables: SampleTables): InvoiceListItem[] {
	const clientName = new Map(
		tables.clients.map((client) => [client.id, client.name]),
	);
	const matterOf = new Map(tables.matters.map((matter) => [matter.id, matter]));
	return tables.invoices
		.map((invoice) => ({
			...invoice,
			clientName: clientName.get(invoice.clientId) ?? "",
			matterName: matterOf.get(invoice.matterId)?.name ?? "",
			matterNumber: matterOf.get(invoice.matterId)?.number ?? "",
		}))
		.sort(
			(first, second) =>
				second.issuedAt.localeCompare(first.issuedAt) ||
				second.number.localeCompare(first.number),
		);
}

/** The totals of the billing header. Amounts are whole USD. */
export type BillingTotals = {
	/** Open balance of every invoice. */
	outstanding: number;
	/** Open balance of the invoices past their due date. */
	overdue: number;
	overdueCount: number;
	/** Payments received in the last BILLING_DAYS days. */
	collected: number;
};

/** The totals of every invoice and of the payments of the last BILLING_DAYS days. */
export function buildBillingTotals(
	tables: SampleTables,
	now: number,
): BillingTotals {
	const periodStart = addLocalDays(startOfLocalDay(now), -(BILLING_DAYS - 1));
	const overdue = tables.invoices.filter(
		(invoice) => invoice.status === "overdue",
	);
	return {
		outstanding: tables.invoices.reduce(
			(sum, invoice) => sum + invoice.amount - invoice.paidAmount,
			0,
		),
		overdue: overdue.reduce(
			(sum, invoice) => sum + invoice.amount - invoice.paidAmount,
			0,
		),
		overdueCount: overdue.length,
		collected: tables.payments
			.filter((payment) => Date.parse(payment.paidAt) >= periodStart)
			.reduce((sum, payment) => sum + payment.amount, 0),
	};
}

/** One line of a time invoice: the hours of one person at their rate. */
export type InvoiceLine = {
	attorneyId: string;
	name: string;
	role: AttorneyRole;
	hours: number;
	/** USD per hour. */
	rate: number;
	/** Whole USD. The lines of an invoice add up to its amount. */
	amount: number;
};

/** Everything the invoice dialog shows. */
export type InvoiceFile = {
	invoice: InvoiceListItem;
	/** One line per person, the largest amount first. Empty on a flat-fee invoice. */
	lines: InvoiceLine[];
	/** The first and the last day of the charged time, YYYY-MM-DD. null on a flat-fee invoice. */
	period: { start: string; end: string } | null;
	/** Oldest first. */
	payments: PaymentRow[];
};

/** The file of one invoice, or null when the id does not exist. */
export function buildInvoiceFile(
	tables: SampleTables,
	invoiceId: string,
): InvoiceFile | null {
	const invoice = buildInvoiceList(tables).find((row) => row.id === invoiceId);
	if (!invoice) {
		return null;
	}
	const entries = tables.timeEntries.filter(
		(entry) => entry.invoiceId === invoiceId,
	);
	const lines = new Map<string, InvoiceLine>();
	for (const entry of entries) {
		const attorney = tables.attorneys.find(
			(person) => person.id === entry.attorneyId,
		);
		if (!attorney) {
			continue;
		}
		const line = lines.get(attorney.id) ?? {
			attorneyId: attorney.id,
			name: attorney.name,
			role: attorney.role,
			hours: 0,
			rate: entry.rate,
			amount: 0,
		};
		line.hours = toTenths(line.hours + entry.hours);
		line.amount += entry.amount;
		lines.set(attorney.id, line);
	}
	const days = entries.map((entry) => entry.day).sort();
	const start = days[0];
	const end = days.at(-1);
	return {
		invoice,
		lines: [...lines.values()].sort(
			(first, second) => second.amount - first.amount,
		),
		period: start && end ? { start, end } : null,
		payments: tables.payments
			.filter((payment) => payment.invoiceId === invoiceId)
			.sort((first, second) => first.paidAt.localeCompare(second.paidAt)),
	};
}
