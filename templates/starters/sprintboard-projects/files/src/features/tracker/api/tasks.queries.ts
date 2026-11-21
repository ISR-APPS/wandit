// Reads of tasks and team members, with the names that the lists show.
// The route loaders prefetch them. The overview, the Projects, Tasks, and Team pages read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	getSampleTables,
	type MemberRow,
	type SampleTables,
	type TaskRow,
} from "../lib/sample-data";

/** One task with the names of its project, its assignee, and its reporter. The times are ISO texts. */
export type Task = TaskRow & {
	/** The project key and the task number: "CHK-42". */
	key: string;
	projectName: string;
	/** null when nobody owns the task yet. */
	assigneeName: string | null;
	reporterName: string;
};

/** One person of the team. */
export type Member = MemberRow;

/** Adds the names to task rows. A database join does this later. */
export function withTaskNames(rows: TaskRow[], tables: SampleTables): Task[] {
	const members = new Map(tables.members.map((member) => [member.id, member]));
	const projects = new Map(
		tables.projects.map((project) => [project.id, project]),
	);
	return rows.map((row) => {
		const project = projects.get(row.projectId);
		return {
			...row,
			key: `${project?.key ?? "?"}-${row.number}`,
			projectName: project?.name ?? "",
			assigneeName: row.assigneeId
				? (members.get(row.assigneeId)?.name ?? null)
				: null,
			reporterName: members.get(row.reporterId)?.name ?? "",
		};
	});
}

/** Every task, the newest first. Pages filter them by project, assignee, or status in the browser. */
export function tasksQueryOptions() {
	return queryOptions({
		queryKey: ["tasks", "list"],
		queryFn: async () => {
			const tables = getSampleTables();
			// LIMIT: every task in one read, filtered in the browser. Upgrade: one query per page with server filters (tables-paging.md of the app-dashboard skill).
			return withTaskNames(tables.tasks, tables).sort((first, second) =>
				second.createdAt.localeCompare(first.createdAt),
			);
		},
	});
}

/** Every member of the team, in name order. */
export function membersQueryOptions() {
	return queryOptions({
		queryKey: ["members", "list"],
		queryFn: async (): Promise<Member[]> =>
			[...getSampleTables().members].sort((first, second) =>
				first.name.localeCompare(second.name),
			),
	});
}
