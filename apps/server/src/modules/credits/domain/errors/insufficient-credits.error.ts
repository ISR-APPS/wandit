/**
 * The 402 that refuses a charge when the paying pool has no credits.
 * CreditsService, the V2 create gate, and the publish gate throw it.
 */
import { HttpException, HttpStatus } from "@nestjs/common";
import type { CreditPayer } from "@wandit/contracts";

export const INSUFFICIENT_CREDITS_ERROR_CODE = "INSUFFICIENT_CREDITS";

/**
 * Constructed with INTERNAL centi-credit amounts (the thrower passes ledger
 * values raw); the constructor divides by 100 exactly once, so the readonly
 * fields, the 402 details, and the message all expose decimal display credits.
 *
 * The user-facing `availableCredits` is the SETTLED balance — the number the
 * header pill shows — never the raw ledger balance, which reserve holds can
 * dip negative mid-run (a "-4.9" beside a pill saying "6.7" reads as a
 * billing bug). The raw value stays available on `rawAvailableCredits` and in
 * the message for server logs.
 */
export class InsufficientCreditsError extends HttpException {
	/** Decimal display credits. */
	readonly requiredCredits: number;
	/** Decimal display credits — settled balance, matching the header pill. */
	readonly availableCredits: number;
	/** Decimal display credits temporarily reserved by running generations. */
	readonly heldCredits: number;
	/** Decimal display credits — raw ledger balance (holds subtracted). */
	readonly rawAvailableCredits: number;

	constructor(
		requiredCentiCredits: number,
		availableCentiCredits: number,
		settledCentiCredits: number = availableCentiCredits,
		/** The pool that refused the charge; the web picks the billing modal by it. */
		payer?: CreditPayer,
	) {
		const requiredCredits = requiredCentiCredits / 100;
		const availableCredits = settledCentiCredits / 100;
		const heldCredits =
			Math.max(0, settledCentiCredits - availableCentiCredits) / 100;
		const rawAvailableCredits = availableCentiCredits / 100;

		super(
			{
				code: INSUFFICIENT_CREDITS_ERROR_CODE,
				details: {
					availableCredits,
					heldCredits,
					...(payer === undefined ? {} : { payer }),
					requiredCredits,
				},
				message: `Insufficient credits: required ${requiredCredits}, available ${availableCredits}${heldCredits > 0 ? ` (${heldCredits} held by running generations, raw ${rawAvailableCredits})` : ""}`,
			},
			HttpStatus.PAYMENT_REQUIRED,
		);
		this.requiredCredits = requiredCredits;
		this.availableCredits = availableCredits;
		this.heldCredits = heldCredits;
		this.rawAvailableCredits = rawAvailableCredits;
	}
}
