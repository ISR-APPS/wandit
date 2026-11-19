// Reads of the header alerts: the entries that wait for the bank, and the budgets over their limit this month.
// HeaderNotifications reads it after the shell renders. A pending entry is the same rule as the "Pending" status
// of the transactions page. "Over" is the same rule as the budgets page: the spend of the month is above the limit.
// The queryFn reads the sample ledger. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { type CategoryId, listBudgets } from "../lib/categories";
import { monthStartOf, toIsoDay } from "../lib/ledger-day";
import { listTransactions } from "../lib/sample-transactions";

// linkOptions types each path, so a wrong path fails typecheck.
function entryLink(transactionId: string) {
	return linkOptions({
		to: "/app/transactions/$transactionId",
		params: { transactionId },
	});
}

function budgetLink(category: CategoryId) {
	return linkOptions({ to: "/app/budgets", search: { category } });
}

/** One alert of the bell menu. `kind` tells the menu which fields to read. */
export type Alert =
	| {
			/** The bank did not confirm the entry yet. */
			kind: "pendingEntry";
			/** The entry number. */
			id: string;
			payee: string;
			memo: string;
			/** The day of the entry, as `YYYY-MM-DD`. */
			day: string;
			link: ReturnType<typeof entryLink>;
	  }
	| {
			/** A category spent more than its monthly limit this month. */
			kind: "overBudget";
			id: CategoryId;
			/** The spend above the limit, in cents and positive. */
			overCents: number;
			/** The day the spend of this month went above the limit, as `YYYY-MM-DD`. */
			day: string;
			link: ReturnType<typeof budgetLink>;
	  };

/** Every alert, the newest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const now = Date.now();
			const rows = listTransactions(now);
			const monthStart = monthStartOf(toIsoDay(now));
			const pending: Alert[] = rows
				.filter((row) => row.status === "pending")
				.map((row) => ({
					kind: "pendingEntry",
					id: row.id,
					payee: row.payee,
					memo: row.memo,
					day: row.day,
					link: entryLink(row.id),
				}));
			const budgets = listBudgets();
			const limitByCategory = new Map(
				budgets.map((budget) => [budget.categoryId, budget.limitCents]),
			);
			const spentByCategory = new Map<CategoryId, number>();
			// The day the spend of the month first went above the limit. The alert carries that day.
			const crossedDayByCategory = new Map<CategoryId, string>();
			const monthExpenses = rows
				// `YYYY-MM-DD` texts compare in date order.
				.filter((row) => row.type === "expense" && row.day >= monthStart)
				.sort((first, second) => first.day.localeCompare(second.day));
			for (const row of monthExpenses) {
				// An expense amount is negative. The minus makes the spend positive.
				const spentCents =
					(spentByCategory.get(row.categoryId) ?? 0) - row.amountCents;
				spentByCategory.set(row.categoryId, spentCents);
				const limitCents = limitByCategory.get(row.categoryId);
				if (
					limitCents !== undefined &&
					spentCents > limitCents &&
					!crossedDayByCategory.has(row.categoryId)
				) {
					crossedDayByCategory.set(row.categoryId, row.day);
				}
			}
			const overBudget: Alert[] = budgets.flatMap((budget) => {
				const overCents =
					(spentByCategory.get(budget.categoryId) ?? 0) - budget.limitCents;
				return overCents > 0
					? [
							{
								kind: "overBudget",
								id: budget.categoryId,
								overCents,
								day: crossedDayByCategory.get(budget.categoryId) ?? monthStart,
								link: budgetLink(budget.categoryId),
							} satisfies Alert,
						]
					: [];
			});
			// Newest first: the bell shows the first 5, and the newest alert needs the user first.
			return [...overBudget, ...pending].sort((first, second) =>
				second.day.localeCompare(first.day),
			);
		},
	});
}
