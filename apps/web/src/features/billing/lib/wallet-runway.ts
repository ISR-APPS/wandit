/**
 * Runway of a wallet: the days that the balance lasts at the spend of the last 30 days.
 * Called by the balance card of pages/billing-page.tsx. Reads only its two arguments.
 */

/** Length of the spend window of `spentLast30DaysCredits` in GET billing/wallet. */
const SPEND_WINDOW_DAYS = 30;

/**
 * Whole days that `balanceCredits` lasts at the daily average of `spentLast30DaysCredits`. Both are decimal credits.
 * Null when the wallet spent nothing or holds nothing: the card then shows "Your credits never expire".
 * Returns 0 when the balance covers less than one day.
 */
export function walletRunwayDays(
	balanceCredits: number,
	spentLast30DaysCredits: number,
): number | null {
	if (spentLast30DaysCredits <= 0 || balanceCredits <= 0) {
		return null;
	}
	// Round down, so the card never promises a day that the balance does not cover.
	// Multiply before the division: 23 / (23 / 30) gives 29.999..., which rounds down to 29.
	return Math.floor(
		(balanceCredits * SPEND_WINDOW_DAYS) / spentLast30DaysCredits,
	);
}
