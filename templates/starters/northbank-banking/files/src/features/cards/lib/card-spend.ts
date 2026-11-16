// The math of the cards pages: the summary of each card, the spend breakdown, the detail of one card,
// and the running spend of one card. cards.queries.ts calls these pure functions with the sample rows.
import {
	addDays,
	type BankCard,
	CARD_SPEND_CATEGORIES,
	CARDS,
	type CardSpendCategory,
	type CardStatus,
	cardStatusOf,
	cardStatusSince,
	countsInBalance,
	type DailyPoint,
	dayPartsOf,
	daysBetween,
	findCard,
	lastDays,
	monthStartOf,
	type Transaction,
} from "~/features/bank";

/** One card with the figures of its tile. Spend values are positive cents. */
export type CardSummary = {
	card: BankCard;
	status: CardStatus;
	/** The day of the issue, the freeze, or the cancel: the start of the current status. */
	statusSince: string;
	/** Card spend since the 1st of this month. The limit resets on the 1st. */
	monthSpendCents: number;
	/** The day of the newest payment, or null for a card with no payment. */
	lastUsedDay: string | null;
	/** The expiry as "MM/YY": four years after the issue month. */
	expiry: string;
};

/** One merchant of a card, with its spend in the last 30 days. */
export type MerchantTotal = {
	name: string;
	/** Positive cents. */
	totalCents: number;
	count: number;
};

/** One part of the spend breakdown, in positive cents. `label` is a spend group code or "other". */
export type SpendSlice = {
	label: CardSpendCategory | "other";
	value: number;
};

/** Everything the card detail page shows, except the daily series that has its own period. */
export type CardDetail = {
	summary: CardSummary;
	/** Every payment of the card, newest first. */
	transactions: Transaction[];
	/** The 5 merchants with the most spend in the last 30 days. */
	topMerchants: MerchantTotal[];
};

// A card keeps its number for four years after the issue month.
const CARD_LIFE_YEARS = 4;

// The breakdown shows this many groups and folds the rest into "other".
const BREAKDOWN_PARTS = 5;

// The detail page lists this many merchants.
const TOP_MERCHANTS = 5;

// The breakdown and the merchant list cover the last 30 days.
const SPEND_WINDOW_DAYS = 30;

// The payments of one card that count, newest first. A returned payment never left the account.
function paymentsOf(rows: Transaction[], cardId: string): Transaction[] {
	return rows.filter((row) => row.cardId === cardId && countsInBalance(row));
}

function summaryOf(
	card: BankCard,
	rows: Transaction[],
	today: string,
): CardSummary {
	const payments = paymentsOf(rows, card.id);
	const monthStart = monthStartOf(today);
	const issued = dayPartsOf(addDays(today, -card.issuedDaysAgo));
	return {
		card,
		status: cardStatusOf(card),
		statusSince: cardStatusSince(card, today),
		// Payments are negative. Subtracting them from 0 gives a positive spend and never "-0".
		monthSpendCents: payments
			.filter((row) => row.day >= monthStart)
			.reduce((sum, row) => sum - row.amountCents, 0),
		lastUsedDay: payments[0]?.day ?? null,
		expiry: `${String(issued.month).padStart(2, "0")}/${String(issued.year + CARD_LIFE_YEARS).slice(-2)}`,
	};
}

/** The summary of every card, in the order of CARDS. `rows` is every entry, newest first. */
export function buildCardSummaries(
	rows: Transaction[],
	today: string,
): CardSummary[] {
	return CARDS.map((card) => summaryOf(card, rows, today));
}

/** Card spend by group in the last 30 days: the 5 largest groups, then "other". Labels are group codes. */
export function buildSpendBreakdown(
	rows: Transaction[],
	today: string,
): SpendSlice[] {
	const totals = new Map<CardSpendCategory, number>();
	for (const row of rows) {
		const category = CARD_SPEND_CATEGORIES.find(
			(item) => item === row.category,
		);
		if (
			category &&
			countsInBalance(row) &&
			daysBetween(row.day, today) < SPEND_WINDOW_DAYS
		) {
			totals.set(category, (totals.get(category) ?? 0) - row.amountCents);
		}
	}
	const sorted = [...totals.entries()]
		.map(([label, value]): SpendSlice => ({ label, value }))
		.sort((first, second) => second.value - first.value);
	const rest = sorted
		.slice(BREAKDOWN_PARTS)
		.reduce((sum, slice) => sum + slice.value, 0);
	return rest > 0
		? [...sorted.slice(0, BREAKDOWN_PARTS), { label: "other", value: rest }]
		: sorted;
}

/** The detail of the card `cardId`, or null for an unknown id. */
export function buildCardDetail(
	rows: Transaction[],
	today: string,
	cardId: string,
): CardDetail | null {
	const card = findCard(cardId);
	if (!card) {
		return null;
	}
	const transactions = rows.filter((row) => row.cardId === cardId);
	const merchants = new Map<string, MerchantTotal>();
	for (const row of transactions) {
		if (
			countsInBalance(row) &&
			daysBetween(row.day, today) < SPEND_WINDOW_DAYS
		) {
			const merchant = merchants.get(row.counterparty) ?? {
				name: row.counterparty,
				totalCents: 0,
				count: 0,
			};
			merchant.totalCents -= row.amountCents;
			merchant.count += 1;
			merchants.set(row.counterparty, merchant);
		}
	}
	return {
		summary: summaryOf(card, rows, today),
		transactions,
		topMerchants: [...merchants.values()]
			.sort((first, second) => second.totalCents - first.totalCents)
			.slice(0, TOP_MERCHANTS),
	};
}

/**
 * The running spend of one card over the last `days` days, against the same days one period earlier.
 * Each point is the sum from the first day of its period, in positive cents. One card pays on few days,
 * so a daily line is mostly 0; the running sum rises in steps that the reader can compare.
 */
export function buildCardRunningSpend(
	rows: Transaction[],
	today: string,
	cardId: string,
	days: number,
): DailyPoint[] {
	const spendByDay = new Map<string, number>();
	for (const row of paymentsOf(rows, cardId)) {
		spendByDay.set(row.day, (spendByDay.get(row.day) ?? 0) - row.amountCents);
	}
	let currentSum = 0;
	let previousSum = 0;
	return lastDays(today, days).map((day) => {
		currentSum += spendByDay.get(day) ?? 0;
		previousSum += spendByDay.get(addDays(day, -days)) ?? 0;
		return { day, current: currentSum, previous: previousSum };
	});
}
