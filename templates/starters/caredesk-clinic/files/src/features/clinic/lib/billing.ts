// The fee of each visit and the payment state of a visit that was done.
// The home KPIs, the Reports tab, and the patient file read it. It stands in for a table `invoices`.
// To make it real: store one invoice per visit, with its amount, its payer, and its paid date.
import type { AppointmentRow } from "./appointment-rows";
import type { BadgeVariant, VisitType } from "./appointment-status";
import { DAY_MS, MINUTE_MS } from "./clinic-day";

/** ISO 4217 code of every amount of the app. Each amount is in whole units of it. */
export const CURRENCY = "USD";

/** The fee of one visit of each kind, in whole units of CURRENCY. A visit that was not done costs nothing. */
export const VISIT_FEES = {
	consultation: 85,
	follow_up: 60,
	check_up: 120,
	vaccination: 40,
	procedure: 180,
	therapy: 70,
	first_visit: 110,
} satisfies Record<VisitType, number>;

/** The states of a payment. The label is the message key `paymentStatuses.<status>`. */
export const PAYMENT_STATUSES = ["paid", "pending", "overdue"] as const;

/** One payment state. "overdue" is a claim that the plan did not pay after 30 days. */
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Badge variant per payment state. Only an overdue claim is red. */
export const PAYMENT_STATUS_BADGE = {
	paid: "success",
	pending: "warning",
	overdue: "destructive",
} satisfies Record<PaymentStatus, BadgeVariant>;

// A plan that has not paid after 30 days is late.
const OVERDUE_AFTER_DAYS = 30;

/** An amount in the app currency, with no cents: the fees are whole units. */
export function moneyFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		maximumFractionDigits: 0,
	});
}

/**
 * The payment state of a visit that was done, at the time `now` (milliseconds since 1970).
 * A self-pay patient pays at the desk. A public plan pays after 10 to 40 days, a private plan after 5 to 25 days.
 */
export function paymentStatusOf(
	row: AppointmentRow,
	now: number,
): PaymentStatus {
	if (row.patient.coverage === "self_pay") {
		return "paid";
	}
	// The minute of the visit gives a stable delay, so a claim keeps its pay day on every load.
	const spread = Math.floor(row.startsAt / MINUTE_MS) % 31;
	const payDays =
		row.patient.coverage === "public" ? 10 + spread : 5 + (spread % 21);
	const ageDays = (now - row.startsAt) / DAY_MS;
	if (ageDays >= payDays) {
		return "paid";
	}
	return ageDays > OVERDUE_AFTER_DAYS ? "overdue" : "pending";
}
