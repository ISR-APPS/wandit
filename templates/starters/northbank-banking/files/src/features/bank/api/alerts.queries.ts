// Reads of the header alerts: returned entries of the last 30 days, cards near their monthly limit, and frozen cards.
// HeaderNotifications reads it after the shell renders. The newest alert comes first.
// The queryFn reads the sample rows. A later version replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { daysBetween, monthStartOf, todayIsoDay } from "../lib/bank-day";
import { CARDS, cardStatusOf, cardStatusSince } from "../lib/sample-cards";
import { countsInBalance, listTransactions } from "../lib/sample-transactions";

// A returned entry stays an alert for 30 days. The transactions page still lists the older ones.
const RETURNED_ALERT_DAYS = 30;

/** A card is near its limit from 80 % of the monthly limit. The cards page uses the same share. */
export const NEAR_LIMIT_SHARE = 0.8;

/** One alert of the bell menu. */
export type Alert = {
	id: string;
	/** "returnedEntry": a check that bounced. "cardNearLimit": a card at 80 % of its limit or more. "cardFrozen": a card that waits for a decision. */
	kind: "returnedEntry" | "cardNearLimit" | "cardFrozen";
	/** The other party of the entry, or the holder and the card ending. */
	title: string;
	/** The amount of the entry, or the card spend this month. Positive cents. */
	amountCents: number;
	/** The day of the event, `YYYY-MM-DD`: the post day, today, or the freeze day. */
	day: string;
	/** The page of the record. linkOptions types the path, so a wrong path fails typecheck. */
	link: ReturnType<typeof transactionLink> | ReturnType<typeof cardLink>;
};

function transactionLink(transactionId: string) {
	return linkOptions({
		to: "/app/transactions/$transactionId",
		params: { transactionId },
	});
}

function cardLink(cardId: string) {
	return linkOptions({ to: "/app/cards/$cardId", params: { cardId } });
}

/** Every alert, the newest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const today = todayIsoDay();
			const rows = listTransactions(today);
			const monthStart = monthStartOf(today);
			const returned: Alert[] = rows
				.filter(
					(row) =>
						row.status === "returned" &&
						daysBetween(row.day, today) < RETURNED_ALERT_DAYS,
				)
				.map((row) => ({
					id: row.id,
					kind: "returnedEntry",
					title: row.counterparty,
					amountCents: Math.abs(row.amountCents),
					day: row.day,
					link: transactionLink(row.id),
				}));
			const cardAlerts: Alert[] = [];
			for (const card of CARDS) {
				const status = cardStatusOf(card);
				const ending = `${card.holderName} ••${card.numberEnding}`;
				// Payments are negative. Subtracting them from 0 gives a positive spend.
				const monthSpend = rows
					.filter(
						(row) =>
							row.cardId === card.id &&
							row.day >= monthStart &&
							countsInBalance(row),
					)
					.reduce((sum, row) => sum - row.amountCents, 0);
				if (status === "frozen") {
					cardAlerts.push({
						id: card.id,
						kind: "cardFrozen",
						title: ending,
						amountCents: monthSpend,
						day: cardStatusSince(card, today),
						link: cardLink(card.id),
					});
				} else if (
					status === "active" &&
					monthSpend >= card.monthlyLimitCents * NEAR_LIMIT_SHARE
				) {
					cardAlerts.push({
						id: card.id,
						kind: "cardNearLimit",
						title: ending,
						amountCents: monthSpend,
						day: today,
						link: cardLink(card.id),
					});
				}
			}
			// Array.sort is stable, so alerts of one day keep the order above.
			return [...returned, ...cardAlerts].sort((first, second) =>
				second.day.localeCompare(first.day),
			);
		},
	});
}
