// Reads of the open follow-up tasks: every task of the team, and the tasks of one deal.
// The activities route and the deal route prefetch them. The follow-up cards read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { getSampleTables, type SampleTables } from "~/features/crm";

/** One open follow-up task with the names that a list shows. */
export type Task = {
	id: string;
	title: string;
	/** ISO time. The day decides the state: overdue, due today, or upcoming. */
	dueAt: string;
	/** The rep that must do the task. */
	assigneeName: string;
	/** The deal that the task moves forward. */
	deal: { id: string; name: string };
	companyName: string;
};

// Adds the names of the rep, the deal, and the company to task rows, and sorts by due time, the most urgent first.
function withNames(rows: SampleTables["tasks"], tables: SampleTables): Task[] {
	const reps = new Map(tables.reps.map((rep) => [rep.id, rep]));
	const deals = new Map(tables.deals.map((row) => [row.id, row]));
	const companies = new Map(tables.companies.map((row) => [row.id, row]));
	return rows
		.map((row) => {
			const deal = deals.get(row.dealId);
			return {
				id: row.id,
				title: row.title,
				dueAt: row.dueAt,
				assigneeName: reps.get(row.assigneeId)?.name ?? "",
				deal: { id: row.dealId, name: deal?.name ?? "" },
				companyName: companies.get(deal?.companyId ?? "")?.name ?? "",
			};
		})
		.sort((first, second) => first.dueAt.localeCompare(second.dueAt));
}

/** Every open task of the team, the most urgent first. Feeds the follow-up card of the activities page. */
export function openTasksQueryOptions() {
	return queryOptions({
		queryKey: ["tasks", "open"],
		queryFn: async () => {
			const tables = getSampleTables();
			return withNames(tables.tasks, tables);
		},
	});
}

/** The open tasks of one deal, the most urgent first. Feeds the follow-up card of the deal page. */
export function dealTasksQueryOptions(dealId: string) {
	return queryOptions({
		queryKey: ["tasks", "deal", dealId],
		queryFn: async () => {
			const tables = getSampleTables();
			return withNames(
				tables.tasks.filter((row) => row.dealId === dealId),
				tables,
			);
		},
	});
}
