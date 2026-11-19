// Reads of projects: the list with the task totals of each project, and one project with its tasks and milestones.
// The route loaders prefetch them. The project list, the project page, and the overview read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	getSampleTables,
	isOverdue,
	type Member,
	type MilestoneRow,
	type ProjectRow,
	type Task,
	withTaskNames,
} from "~/features/tracker";

/** One project with the totals that the list shows. */
export type Project = ProjectRow & {
	leadName: string;
	taskCount: number;
	/** Tasks that are not done, backlog included. */
	openCount: number;
	/** Open tasks with a due time in the past. */
	overdueCount: number;
	/** The sum of the estimates of every task, in story points. */
	pointsTotal: number;
	/** The sum of the estimates of the done tasks. Progress is pointsDone / pointsTotal. */
	pointsDone: number;
};

/** One project with the records that only its own page shows. */
export type ProjectDetail = Project & {
	/** The checkpoints, the earliest due first. */
	milestones: MilestoneRow[];
	/** The members of the project, the lead first. */
	members: Member[];
	/** Every task of the project, the newest first. */
	tasks: Task[];
};

// Adds the lead name and the task totals to project rows. A database view does this later.
function withTotals(
	tables: ReturnType<typeof getSampleTables>,
	now: number,
): Project[] {
	const members = new Map(tables.members.map((member) => [member.id, member]));
	return tables.projects.map((project) => {
		const tasks = tables.tasks.filter((task) => task.projectId === project.id);
		const done = tasks.filter((task) => task.status === "done");
		return {
			...project,
			leadName: members.get(project.leadId)?.name ?? "",
			taskCount: tasks.length,
			openCount: tasks.length - done.length,
			overdueCount: tasks.filter((task) => isOverdue(task, now)).length,
			pointsTotal: tasks.reduce((sum, task) => sum + task.estimate, 0),
			pointsDone: done.reduce((sum, task) => sum + task.estimate, 0),
		};
	});
}

/** Every project, in the fixed order of the team. The list page filters them by status. */
export function projectsQueryOptions() {
	return queryOptions({
		queryKey: ["projects", "list"],
		queryFn: async () => withTotals(getSampleTables(), Date.now()),
	});
}

/** One project with its milestones, members, and tasks. null when the id does not exist. */
export function projectQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["projects", "detail", id],
		queryFn: async (): Promise<ProjectDetail | null> => {
			const tables = getSampleTables();
			const project = withTotals(tables, Date.now()).find(
				(row) => row.id === id,
			);
			// The id comes from the URL. An unknown id is "not found", not an error.
			if (!project) {
				return null;
			}
			const members = new Map(
				tables.members.map((member) => [member.id, member]),
			);
			return {
				...project,
				milestones: tables.milestones
					.filter((milestone) => milestone.projectId === id)
					.sort((first, second) => first.dueAt.localeCompare(second.dueAt)),
				members: project.memberIds.flatMap((memberId) => {
					const member = members.get(memberId);
					return member ? [member] : [];
				}),
				tasks: withTaskNames(
					tables.tasks.filter((task) => task.projectId === id),
					tables,
				).sort((first, second) =>
					second.createdAt.localeCompare(first.createdAt),
				),
			};
		},
	});
}
