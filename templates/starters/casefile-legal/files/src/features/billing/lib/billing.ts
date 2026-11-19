// The math of the billing page: the KPI row of a period, the recent invoices and payments, the open invoices,
// and the file of one invoice. billing.queries.ts calls these functions in its queryFn.
// It is pure: every function takes the rows and "now", so a later SQL function gives the same numbers.
import {
	type AttorneyRole,
	addLocalDays,
	buildDailySeries,
	changeRatio,
	DAY_MS,
	dayKeyOf,
	type InvoiceRow,
	type PaymentRow,
	type SampleTables,
	startOfLocalDay,
	toTenths,
} from "~/features/practice";

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

/** One figure with its change against the period before. `change` is null when the period before is 0. */
export type Figure = { value: number; change: number | null };

/** Every number of the billing KPI row for one period. Amounts are whole USD. */
export type BillingSummary = {
	/** Payments received in the period. */
	collected: Figure;
	/** Invoices issued in the period. */
	billed: Figure;
	/** Mean days from issue to payment, over the payments of the period. null when the period has no payment. */
	daysToPay: { value: number | null; change: number | null };
	/** Open balance of every invoice now, with the count of open and overdue invoices. */
	outstanding: { value: number; openCount: number; overdueCount: number };
	/** Amount invoiced per local day of the period, oldest first. The mini bars of the outstanding card. */
	invoicedPerDay: { day: string; amount: number }[];
};

/** The KPI row of the billing page for the last `days` local days up to now. */
export function buildBillingSummary(
	tables: SampleTables,
	days: number,
	now: number,
): BillingSummary {
	const today = startOfLocalDay(now);
	const periodStart = addLocalDays(today, -(days - 1));
	const previousStart = addLocalDays(today, -(2 * days - 1));
	const issuedAt = new Map(
		tables.invoices.map((invoice) => [
			invoice.id,
			Date.parse(invoice.issuedAt),
		]),
	);
	const isBetween = (iso: string, start: number, end: number) => {
		const moment = Date.parse(iso);
		return moment >= start && moment < end;
	};
	const sumPayments = (start: number, end: number) =>
		tables.payments
			.filter((payment) => isBetween(payment.paidAt, start, end))
			.reduce((sum, payment) => sum + payment.amount, 0);
	const sumInvoices = (start: number, end: number) =>
		tables.invoices
			.filter((invoice) => isBetween(invoice.issuedAt, start, end))
			.reduce((sum, invoice) => sum + invoice.amount, 0);
	// The mean of whole days between the issue and the payment, rounded to one day.
	const meanDaysToPay = (start: number, end: number): number | null => {
		const waits = tables.payments
			.filter((payment) => isBetween(payment.paidAt, start, end))
			.map(
				(payment) =>
					(Date.parse(payment.paidAt) -
						(issuedAt.get(payment.invoiceId) ?? 0)) /
					DAY_MS,
			);
		return waits.length === 0
			? null
			: Math.round(waits.reduce((sum, wait) => sum + wait, 0) / waits.length);
	};
	const collected = sumPayments(periodStart, now + 1);
	const billed = sumInvoices(periodStart, now + 1);
	const daysToPay = meanDaysToPay(periodStart, now + 1);
	const daysToPayBefore = meanDaysToPay(previousStart, periodStart);
	const open = tables.invoices.filter(
		(invoice) => invoice.amount > invoice.paidAmount,
	);
	const invoicedByDay = new Map<string, number>();
	for (const invoice of tables.invoices) {
		const day = dayKeyOf(Date.parse(invoice.issuedAt));
		invoicedByDay.set(day, (invoicedByDay.get(day) ?? 0) + invoice.amount);
	}
	return {
		collected: {
			value: collected,
			change: changeRatio(collected, sumPayments(previousStart, periodStart)),
		},
		billed: {
			value: billed,
			change: changeRatio(billed, sumInvoices(previousStart, periodStart)),
		},
		daysToPay: {
			value: daysToPay,
			change:
				daysToPay === null || daysToPayBefore === null
					? null
					: changeRatio(daysToPay, daysToPayBefore),
		},
		outstanding: {
			value: open.reduce(
				(sum, invoice) => sum + invoice.amount - invoice.paidAmount,
				0,
			),
			openCount: open.length,
			overdueCount: open.filter((invoice) => invoice.status === "overdue")
				.length,
		},
		invoicedPerDay: buildDailySeries(days, now, invoicedByDay).map((point) => ({
			day: point.day,
			amount: point.current,
		})),
	};
}

/** One line of the "Recent" list: an invoice that the firm issued, or a payment that a client made. */
export type LedgerLine = {
	/** The invoice id or the payment id. Also the React key. */
	id: string;
	kind: "invoice" | "payment";
	/** ISO time of the issue or of the payment. */
	at: string;
	/** The invoice of the line. The row button opens its dialog. */
	invoice: InvoiceListItem;
	/** In whole USD: the invoice amount, or the payment amount. */
	amount: number;
};

/** The invoices issued and the payments received in the last `days` local days, newest first. */
export function buildRecentLines(
	tables: SampleTables,
	days: number,
	now: number,
): LedgerLine[] {
	const periodStart = addLocalDays(startOfLocalDay(now), -(days - 1));
	const invoices = buildInvoiceList(tables);
	const invoiceOf = new Map(invoices.map((invoice) => [invoice.id, invoice]));
	const issued: LedgerLine[] = invoices
		.filter((invoice) => Date.parse(invoice.issuedAt) >= periodStart)
		.map((invoice) => ({
			id: invoice.id,
			kind: "invoice",
			at: invoice.issuedAt,
			invoice,
			amount: invoice.amount,
		}));
	const paid: LedgerLine[] = tables.payments
		.filter((payment) => Date.parse(payment.paidAt) >= periodStart)
		.flatMap((payment) => {
			const invoice = invoiceOf.get(payment.invoiceId);
			return invoice
				? [
						{
							id: payment.id,
							kind: "payment" as const,
							at: payment.paidAt,
							invoice,
							amount: payment.amount,
						},
					]
				: [];
		});
	return [...issued, ...paid].sort((first, second) =>
		second.at.localeCompare(first.at),
	);
}

/** Every invoice with an open balance, the earliest due date first. Overdue invoices come at the top. */
export function buildOpenInvoices(tables: SampleTables): InvoiceListItem[] {
	return buildInvoiceList(tables)
		.filter((invoice) => invoice.amount > invoice.paidAmount)
		.sort((first, second) => first.dueAt.localeCompare(second.dueAt));
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
