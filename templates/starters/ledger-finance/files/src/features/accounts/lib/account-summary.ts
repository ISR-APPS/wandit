// The math of the accounts pages: the figures of one account and the position of the whole business.
// accounts.queries.ts calls these functions with the rows of the sample ledger. They read no clock.
import {
	type Account,
	addDays,
	type CategoryId,
	changeRatio,
	type DailyBalance,
	type Transaction,
} from "~/features/ledger";

/** The money figures of an account cover this many days. */
export const ACCOUNT_FLOW_DAYS = 30;

/** One account with the figures that the accounts pages show. */
export type AccountSummary = Account & {
	/** The balance now, in cents. Negative on the card: the studio owes this amount. */
	balanceCents: number;
	/** Money that came into the account in the last 30 days, in cents. Transfers count. */
	moneyInCents: number;
	/** Money that left the account in the last 30 days, in cents and positive. Transfers count. */
	moneyOutCents: number;
	/** The balance at the end of each day, oldest first: the day before the history, then its 90 days. */
	balances: DailyBalance[];
	/** Count of the entries that the bank did not confirm yet. */
	pendingCount: number;
	/** The last day the team checked the account against its statement. null when no entry is reconciled. */
	lastReconciledDay: string | null;
};

/** The spend of one category on one account. */
export type CategorySpend = {
	categoryId: CategoryId;
	/** In cents and positive. */
	spentCents: number;
};

/** The position of the business: what it holds, what it owes, and the difference. All in cents. */
export type Position = {
	/** The sum of every account that is not a card. */
	cashOnHandCents: number;
	/** What the cards owe, as a positive amount. */
	cardDebtCents: number;
	/** Cash on hand minus the card debt. */
	netCents: number;
	/** The change of each figure against the end of the day 30 days ago. The home compares the same days. */
	changes: Record<"cashOnHand" | "cardDebt" | "net", number | null>;
};

/** The figures of one account. `rows` is every entry of the ledger, `today` is `YYYY-MM-DD`. */
export function buildAccountSummary(
	account: Account,
	rows: Transaction[],
	balances: DailyBalance[],
	today: string,
): AccountSummary {
	const flowStart = addDays(today, 1 - ACCOUNT_FLOW_DAYS);
	const ownRows = rows.filter((row) => row.accountId === account.id);
	// `YYYY-MM-DD` texts compare in date order.
	const recentRows = ownRows.filter((row) => row.day >= flowStart);
	return {
		...account,
		balanceCents: balances.at(-1)?.balanceCents ?? 0,
		moneyInCents: recentRows.reduce(
			(sum, row) => sum + Math.max(row.amountCents, 0),
			0,
		),
		moneyOutCents: recentRows.reduce(
			(sum, row) => sum - Math.min(row.amountCents, 0),
			0,
		),
		balances,
		pendingCount: ownRows.filter((row) => row.status === "pending").length,
		lastReconciledDay: ownRows.reduce<string | null>(
			(last, row) =>
				row.reconciledDay !== null &&
				(last === null || row.reconciledDay > last)
					? row.reconciledDay
					: last,
			null,
		),
	};
}

// Cash on hand and card debt at the end of `day`, in cents. An account with no point for that day counts as 0.
function positionOn(accounts: AccountSummary[], day: string) {
	let cashOnHandCents = 0;
	let cardDebtCents = 0;
	for (const account of accounts) {
		const balanceCents =
			account.balances.find((point) => point.day === day)?.balanceCents ?? 0;
		if (account.type === "credit_card") {
			// A card balance is negative, so the debt is its opposite.
			cardDebtCents -= balanceCents;
		} else {
			cashOnHandCents += balanceCents;
		}
	}
	return {
		cashOnHandCents,
		cardDebtCents,
		netCents: cashOnHandCents - cardDebtCents,
	};
}

/** The position of the business at the end of `today` (`YYYY-MM-DD`), with the change of each figure in 30 days. */
export function buildPosition(
	accounts: AccountSummary[],
	today: string,
): Position {
	const now = positionOn(accounts, today);
	const before = positionOn(accounts, addDays(today, -ACCOUNT_FLOW_DAYS));
	return {
		...now,
		changes: {
			cashOnHand: changeRatio(now.cashOnHandCents, before.cashOnHandCents),
			cardDebt: changeRatio(now.cardDebtCents, before.cardDebtCents),
			net: changeRatio(now.netCents, before.netCents),
		},
	};
}

// The card of an account lists at most this many categories.
const TOP_CATEGORY_COUNT = 4;

/** The largest expense categories of one account in the last 30 days, the largest first. */
export function buildTopCategories(
	accountId: Account["id"],
	rows: Transaction[],
	today: string,
): CategorySpend[] {
	const flowStart = addDays(today, 1 - ACCOUNT_FLOW_DAYS);
	const spentByCategory = new Map<CategoryId, number>();
	for (const row of rows) {
		if (
			row.accountId === accountId &&
			row.type === "expense" &&
			row.day >= flowStart
		) {
			spentByCategory.set(
				row.categoryId,
				(spentByCategory.get(row.categoryId) ?? 0) - row.amountCents,
			);
		}
	}
	return [...spentByCategory]
		.map(([categoryId, spentCents]) => ({ categoryId, spentCents }))
		.sort((first, second) => second.spentCents - first.spentCents)
		.slice(0, TOP_CATEGORY_COUNT);
}
