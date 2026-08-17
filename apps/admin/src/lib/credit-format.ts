// Pricing v4: the API carries decimal credits (the server converts internal
// centi-credits at the boundary). Two display rules apply everywhere in the
// admin app: balances floor to one decimal — never show more than the account
// has — while charges and grants show the exact amount with trailing zeros
// trimmed (0.01, 0.87, 3, 20).

/** Floor to one decimal without ever rounding up (37 → 37, 2.99 → 2.9). */
export function floorCreditBalance(value: number): number {
	return Math.floor(value * 10) / 10;
}

/** Snap float dust back to the wire format's 0.01-credit steps. */
export function roundCreditAmount(value: number): number {
	return Math.round(value * 100) / 100;
}

/** Balance display: floored, always one decimal ("37.0", "2.9", "1,240.5"). */
export function formatCreditBalance(value: number, locale = "en-US") {
	return new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(floorCreditBalance(value));
}

/** Charge/grant display: exact 2-dp amount, trailing zeros trimmed. */
export function formatCreditAmount(value: number, locale = "en-US") {
	return new Intl.NumberFormat(locale, {
		maximumFractionDigits: 2,
	}).format(roundCreditAmount(value));
}
