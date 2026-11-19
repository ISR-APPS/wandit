// The math of the cards pages: the summary of each card, the totals of the KPI row, and the detail of one card.
// cards.queries.ts calls these pure functions with the sample rows.
import {
	addDays,
	addMonths,
	type BankCard,
	CARDS,
	type CardStatus,
	cardStatusOf,
	cardStatusSince,
	countsInBalance,
	dayPartsOf,
	daysBetween,
	findCard,
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

// The detail page lists this many merchants.
const TOP_MERCHANTS = 5;

// The merchant list covers the last 30 days.
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

/** The figures of the KPI row of the cards page. Spend values are positive cents. */
export type CardTotals = {
	/** Card spend since the 1st of this month, all cards. */
	monthSpendCents: number;
	/** Card spend of the same days of the month before: the 1st to the same day of the month. */
	previousSpendCents: number;
	/** Card payments since the 1st of this month. */
	paymentCount: number;
	/** Card payments of the same days of the month before. */
	previousPaymentCount: number;
	/** The sum of the monthly limits of the active cards. */
	activeLimitCents: number;
	/** Spend of the active cards since the 1st. The "left on limits" figure subtracts it from the limits. */
	activeSpendCents: number;
	activeCount: number;
};

/** The totals of the KPI row. The month before stops on the same day of the month, so both spans match. */
export function buildCardTotals(
	rows: Transaction[],
	today: string,
): CardTotals {
	const monthStart = monthStartOf(today);
	const previousStart = addMonths(today, -1);
	// The same day of the month before. Day 31 meets the last day of a shorter month.
	const sameDay = addDays(previousStart, dayPartsOf(today).dayOfMonth - 1);
	const previousEnd = sameDay >= monthStart ? addDays(monthStart, -1) : sameDay;
	const summaries = buildCardSummaries(rows, today);
	const active = summaries.filter((summary) => summary.status === "active");
	let previousSpendCents = 0;
	let previousPaymentCount = 0;
	let paymentCount = 0;
	for (const row of rows) {
		if (row.method !== "card" || !countsInBalance(row)) {
			continue;
		}
		if (row.day >= monthStart) {
			paymentCount += 1;
		} else if (row.day >= previousStart && row.day <= previousEnd) {
			previousPaymentCount += 1;
			previousSpendCents -= row.amountCents;
		}
	}
	return {
		monthSpendCents: summaries.reduce(
			(sum, summary) => sum + summary.monthSpendCents,
			0,
		),
		previousSpendCents,
		paymentCount,
		previousPaymentCount,
		activeLimitCents: active.reduce(
			(sum, summary) => sum + summary.card.monthlyLimitCents,
			0,
		),
		activeSpendCents: active.reduce(
			(sum, summary) => sum + summary.monthSpendCents,
			0,
		),
		activeCount: active.length,
	};
}
