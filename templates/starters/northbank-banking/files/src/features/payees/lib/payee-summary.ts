// The math of the payees pages: the figures of each payee, and the detail of one payee.
// payees.queries.ts calls these pure functions with the sample rows. A later version runs them in SQL.
import {
	addMonths,
	countsInBalance,
	daysBetween,
	findPayee,
	monthStartOf,
	PAYEES,
	type Payee,
	type Transaction,
} from "~/features/bank";

// The window of the "paid" column, in days.
const PAID_WINDOW_DAYS = 90;

// The detail page shows the spend of this many months, the current month included.
const MONTH_COUNT = 6;

/** One payee with the figures of its table row. Paid values are positive cents. */
export type PayeeSummary = {
	/** The id of the payee. DataTable keys its rows by it. */
	id: string;
	payee: Payee;
	/** The day of the newest payment, or null for a payee with no payment. */
	lastPaidDay: string | null;
	/** The sum of the payments of the last 90 days. */
	paidCents: number;
	/** The count of the payments of the last 90 days. */
	paymentCount: number;
};

/** The payments to one payee in one calendar month. */
export type PayeeMonth = {
	/** The first day of the month, `YYYY-MM-01`. */
	month: string;
	/** Positive cents. */
	totalCents: number;
};

/** Everything the payee detail page shows. */
export type PayeeDetail = {
	summary: PayeeSummary;
	/** Every payment to the payee, newest first. */
	payments: Transaction[];
	/** The last 6 calendar months, oldest first. A month with no payment has 0. */
	months: PayeeMonth[];
};

// The payments to one payee that left the account, newest first.
function paymentsTo(rows: Transaction[], payeeId: string): Transaction[] {
	return rows.filter((row) => row.payeeId === payeeId && countsInBalance(row));
}

function summaryOf(
	payee: Payee,
	rows: Transaction[],
	today: string,
): PayeeSummary {
	const payments = paymentsTo(rows, payee.id);
	const recent = payments.filter(
		(row) => daysBetween(row.day, today) < PAID_WINDOW_DAYS,
	);
	return {
		id: payee.id,
		payee,
		lastPaidDay: payments[0]?.day ?? null,
		// Payments are negative. Subtracting them from 0 gives a positive total and never "-0".
		paidCents: recent.reduce((sum, row) => sum - row.amountCents, 0),
		paymentCount: recent.length,
	};
}

/** The figures of every payee, in the order of PAYEES. `rows` is every entry, newest first. */
export function buildPayeeSummaries(
	rows: Transaction[],
	today: string,
): PayeeSummary[] {
	return PAYEES.map((payee) => summaryOf(payee, rows, today));
}

/** The detail of the payee `payeeId`, or null for an unknown id. */
export function buildPayeeDetail(
	rows: Transaction[],
	today: string,
	payeeId: string,
): PayeeDetail | null {
	const payee = findPayee(payeeId);
	if (!payee) {
		return null;
	}
	const payments = paymentsTo(rows, payeeId);
	const thisMonth = monthStartOf(today);
	const months = Array.from({ length: MONTH_COUNT }, (_, index) => {
		const month = addMonths(thisMonth, index - MONTH_COUNT + 1);
		return {
			month,
			totalCents: payments
				.filter((row) => monthStartOf(row.day) === month)
				.reduce((sum, row) => sum - row.amountCents, 0),
		};
	});
	return {
		summary: summaryOf(payee, rows, today),
		payments: rows.filter((row) => row.payeeId === payeeId),
		months,
	};
}
