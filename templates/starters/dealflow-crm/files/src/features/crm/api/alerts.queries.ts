// Reads of the header alerts: the overdue follow-up tasks and the stalled deals, the oldest first.
// HeaderNotifications reads it after the shell renders. The rules come from lib/task.ts and lib/deal-stage.ts,
// so the bell counts the same tasks as the "Overdue" filter of the Activities page.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { isStalledDeal } from "../lib/deal-stage";
import { getSampleTables } from "../lib/sample-data";
import { taskDueState } from "../lib/task";

// Each alert opens the page of its deal. linkOptions types the path, so a wrong path fails typecheck.
function dealLink(dealId: string) {
	return linkOptions({ to: "/app/deals/$dealId", params: { dealId } });
}

/** One alert of the bell menu. */
export type Alert = {
	id: string;
	/** "overdueTask": a follow-up past its due day. "stalledDeal": an open deal too long in one stage. */
	kind: "overdueTask" | "stalledDeal";
	/** The task title or the deal name. */
	title: string;
	/** The company of the deal. */
	detail: string;
	/** ISO time: the due time of the task, or the time the deal entered its stage. */
	at: string;
	link: ReturnType<typeof dealLink>;
};

/** Every alert, the oldest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const tables = getSampleTables();
			const now = Date.now();
			const deals = new Map(tables.deals.map((deal) => [deal.id, deal]));
			const companies = new Map(
				tables.companies.map((company) => [company.id, company.name]),
			);
			const overdueTasks: Alert[] = tables.tasks
				.filter((task) => taskDueState(task.dueAt, now) === "overdue")
				.map((task) => ({
					id: task.id,
					kind: "overdueTask",
					title: task.title,
					detail: companies.get(deals.get(task.dealId)?.companyId ?? "") ?? "",
					at: task.dueAt,
					link: dealLink(task.dealId),
				}));
			const stalledDeals: Alert[] = tables.deals
				.filter((deal) => isStalledDeal(deal, now))
				.map((deal) => ({
					id: deal.id,
					kind: "stalledDeal",
					title: deal.name,
					detail: companies.get(deal.companyId) ?? "",
					at: deal.stageChangedAt,
					link: dealLink(deal.id),
				}));
			return [...overdueTasks, ...stalledDeals].sort((first, second) =>
				first.at.localeCompare(second.at),
			);
		},
	});
}
