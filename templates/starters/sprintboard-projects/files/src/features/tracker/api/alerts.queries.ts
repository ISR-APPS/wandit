// Reads of the header alerts: the overdue tasks, the oldest due time first.
// HeaderNotifications reads it after the shell renders. The rule is isOverdue of lib/task-rules.ts,
// so the bell counts the same tasks as the "Overdue" KPI of the home and the "Overdue" filter of the Tasks page.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { getSampleTables } from "../lib/sample-data";
import { isOverdue } from "../lib/task-rules";

// Each alert opens the board of its project. linkOptions types the path, so a wrong path fails typecheck.
function projectBoardLink(projectId: string) {
	return linkOptions({
		to: "/app/projects/$projectId",
		params: { projectId },
		search: { tab: "board" },
	});
}

/** One alert of the bell menu. */
export type Alert = {
	/** Id of the task row. */
	id: string;
	/** The task title. */
	title: string;
	/** The task key and the project name: "CHK-42 · Checkout revamp". */
	detail: string;
	/** ISO due time of the task (17:00 of its due day). */
	at: string;
	link: ReturnType<typeof projectBoardLink>;
};

/** Every overdue task, the oldest due time first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const tables = getSampleTables();
			const now = Date.now();
			const projects = new Map(
				tables.projects.map((project) => [project.id, project]),
			);
			return tables.tasks
				.filter((task) => isOverdue(task, now))
				.flatMap((task) => {
					const project = projects.get(task.projectId);
					// isOverdue keeps only tasks with a due time, so dueAt is set here.
					if (!project || task.dueAt === null) {
						return [];
					}
					return [
						{
							id: task.id,
							title: task.title,
							detail: `${project.key}-${task.number} · ${project.name}`,
							at: task.dueAt,
							link: projectBoardLink(project.id),
						},
					];
				})
				.sort((first, second) => first.at.localeCompare(second.at));
		},
	});
}
