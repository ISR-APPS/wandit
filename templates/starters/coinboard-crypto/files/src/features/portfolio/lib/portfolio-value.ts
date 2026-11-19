// The value math of the whole portfolio: its value at a past price step, in total and per account.
// portfolio.queries.ts calls it for the overview card and the balance chart. A SQL read function does the same sums later.
import {
	ACCOUNTS,
	type Account,
	buildPositionStates,
	PRICE_STEP_MS,
	priceStepsAgo,
	roundCents,
	type SampleLedger,
} from "~/features/ledger";

/** The value of each account at one time, in the app currency. */
export type AccountValues = Record<Account, number>;

/**
 * The value of each account `stepsAgo` steps of 6 hours before the start of today: the units held then, at the prices of then.
 * The account of an asset is the account of its first transaction. Each asset is rounded to cents first,
 * so the sum of the accounts equals the sum of the Holdings rows.
 */
export function accountValuesStepsAgo(
	ledger: SampleLedger,
	stepsAgo: number,
): AccountValues {
	const accountOf = new Map<string, Account>();
	for (const row of ledger.transactions) {
		if (!accountOf.has(row.assetId)) {
			accountOf.set(row.assetId, row.account);
		}
	}
	const values: AccountValues = { vault: 0, staking: 0, trading: 0 };
	const states = buildPositionStates(
		ledger.transactions,
		ledger.anchor - stepsAgo * PRICE_STEP_MS,
	);
	for (const state of states.values()) {
		const account = accountOf.get(state.assetId);
		if (account) {
			values[account] += roundCents(
				state.quantity * priceStepsAgo(ledger, state.assetId, stepsAgo),
			);
		}
	}
	for (const account of ACCOUNTS) {
		values[account] = roundCents(values[account]);
	}
	return values;
}

/** The value of the whole portfolio `stepsAgo` steps of 6 hours before the start of today. 0 steps ago is the current value. */
export function portfolioValueStepsAgo(
	ledger: SampleLedger,
	stepsAgo: number,
): number {
	const values = accountValuesStepsAgo(ledger, stepsAgo);
	return roundCents(
		ACCOUNTS.reduce((sum, account) => sum + values[account], 0),
	);
}
