export const COMMISSIONABLE_BILLING_REASONS = [
	"subscription_create",
	"subscription_cycle",
	"subscription_update",
] as const;

export type CommissionableBillingReason =
	(typeof COMMISSIONABLE_BILLING_REASONS)[number];

export function isCommissionableBillingReason(
	value: string | null | undefined,
): value is CommissionableBillingReason {
	return (COMMISSIONABLE_BILLING_REASONS as readonly string[]).includes(
		value ?? "",
	);
}

export function affiliateInvoiceBaseCents(input: {
	amountPaid: number;
	totalExcludingTax: number | null | undefined;
}): number {
	if (!Number.isSafeInteger(input.amountPaid)) {
		throw new Error("Stripe invoice amount_paid must be a safe integer");
	}

	if (
		input.totalExcludingTax !== null &&
		input.totalExcludingTax !== undefined &&
		!Number.isSafeInteger(input.totalExcludingTax)
	) {
		throw new Error(
			"Stripe invoice total_excluding_tax must be a safe integer when present",
		);
	}

	return Math.min(
		input.totalExcludingTax ?? input.amountPaid,
		input.amountPaid,
	);
}

export function percentageCommissionCents(
	baseAmountCents: number,
	rateBps: number,
): number {
	if (
		!Number.isSafeInteger(baseAmountCents) ||
		!Number.isSafeInteger(rateBps) ||
		rateBps < 0 ||
		rateBps > 10_000
	) {
		throw new Error("Invalid percentage commission inputs");
	}

	return Math.round((baseAmountCents * rateBps) / 10_000);
}

/**
 * Prorates an earning against a cumulative adverse charge amount.
 *
 * The intermediate product can exceed Number.MAX_SAFE_INTEGER even though all
 * three Stripe/database cent values are individually valid integers. BigInt
 * keeps the calculation exact and the half-up rounding matches Math.round for
 * this non-negative ratio.
 */
export function proportionalClawbackCents(input: {
	adverseAmountCents: number;
	chargeAmountCents: number;
	earningAmountCents: number;
}): number {
	if (
		!Number.isSafeInteger(input.adverseAmountCents) ||
		!Number.isSafeInteger(input.chargeAmountCents) ||
		!Number.isSafeInteger(input.earningAmountCents) ||
		input.adverseAmountCents < 0 ||
		input.chargeAmountCents <= 0 ||
		input.earningAmountCents < 0
	) {
		throw new Error("Invalid affiliate clawback inputs");
	}

	const denominator = BigInt(input.chargeAmountCents);
	const numerator =
		BigInt(input.earningAmountCents) * BigInt(input.adverseAmountCents);
	const rounded = (numerator + denominator / 2n) / denominator;

	return Number(rounded);
}

export function addUtcMonths(date: Date, months: number): Date {
	if (!Number.isSafeInteger(months) || months <= 0) {
		throw new Error("Commission duration months must be a positive integer");
	}

	const result = new Date(date);
	const originalDay = result.getUTCDate();

	result.setUTCDate(1);
	result.setUTCMonth(result.getUTCMonth() + months);
	const lastDay = new Date(
		Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
	).getUTCDate();
	result.setUTCDate(Math.min(originalDay, lastDay));

	return result;
}

export function attributionEarnsAt(
	clickedAt: Date,
	lockedAt: Date,
	durationMonths: number | null,
	paidAt: Date,
): boolean {
	// A checkout can complete after the server-issued click but just before the
	// signup hook locks attribution. The candidate reconciliation path must keep
	// that intentional ordering window eligible.
	if (paidAt < clickedAt) {
		return false;
	}

	return durationMonths === null
		? true
		: paidAt < addUtcMonths(lockedAt, durationMonths);
}

export function addDays(date: Date, days: number): Date {
	if (!Number.isSafeInteger(days) || days < 0) {
		throw new Error("Affiliate hold days must be a non-negative integer");
	}

	return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function payoutEntryRemainsEligible(input: {
	amountCents: number;
	attributionActive: boolean;
	candidateProcessed: boolean;
	commissionStatus: "approved" | "paid" | "pending" | "reversed";
	originalPayoutId: string | null;
	originalStatus: "approved" | "paid" | "pending" | "reversed" | null;
	payoutId: string;
	unresolvedFraud: boolean;
}): boolean {
	if (input.commissionStatus !== "approved") {
		return false;
	}

	if (input.amountCents >= 0) {
		return (
			input.candidateProcessed &&
			input.attributionActive &&
			!input.unresolvedFraud
		);
	}

	if (input.originalStatus === "paid") {
		return true;
	}

	return (
		input.originalStatus === "approved" &&
		input.originalPayoutId === input.payoutId &&
		input.candidateProcessed &&
		input.attributionActive &&
		!input.unresolvedFraud
	);
}
