// Builds the detail view of one project: its facts, its people, and its deliverables as board items.
// projectQueryOptions calls it inside its queryFn. Pure: it reads the sample rows and returns new objects.
import {
	type Day,
	type Deliverable,
	daysBetween,
	isInLastDays,
	type Priority,
	type ProjectSummary,
	priorityOf,
	type StudioData,
	summarizeProjects,
} from "~/features/studio";

// A retainer keeps every two-week cycle. The board shows the cycles approved in the last 90 days and the open ones.
const RETAINER_BOARD_DAYS = 90;

/** One person on the project, with the hours they logged on it. */
export type ProjectPerson = {
	id: string;
	name: string;
	role: StudioData["members"][number]["role"];
	hours: number;
	/** The last day this person logged time on the project, or null. */
	lastDay: Day | null;
	isLead: boolean;
};

/** One deliverable of the task board, with the name of its owner and its priority. */
export type BoardItem = Deliverable & {
	ownerName: string;
	/** From the days left before the due day. null for an approved deliverable: nothing is left to do. */
	priority: Priority | null;
};

/** Everything the detail page shows about one project. */
export type ProjectDetail = {
	project: ProjectSummary;
	people: ProjectPerson[];
	/** The nearest due day first. */
	items: BoardItem[];
};

/** The detail of one project, or null when the id is unknown. */
export function buildProjectDetail(
	data: StudioData,
	projectId: string,
): ProjectDetail | null {
	const project = summarizeProjects(data).find((row) => row.id === projectId);
	if (!project) {
		return null;
	}
	const entries = data.entries.filter((entry) => entry.projectId === projectId);
	const memberName = new Map(
		data.members.map((member) => [member.id, member.name]),
	);
	const isRetainer = project.dueDay === null;

	// A team id with no member row (a person who left) has no name or role to show, so it is left out.
	const people = project.teamIds.flatMap((memberId): ProjectPerson[] => {
		const member = data.members.find((row) => row.id === memberId);
		if (!member) {
			return [];
		}
		const own = entries.filter((entry) => entry.memberId === memberId);
		return [
			{
				id: memberId,
				name: member.name,
				role: member.role,
				hours: own.reduce((sum, entry) => sum + entry.hours, 0),
				lastDay: own.reduce<Day | null>(
					(last, entry) =>
						last === null || daysBetween(last, entry.day) > 0
							? entry.day
							: last,
					null,
				),
				isLead: memberId === project.leadId,
			},
		];
	});

	const items = data.deliverables
		.filter((deliverable) => deliverable.projectId === projectId)
		.filter(
			(deliverable) =>
				!isRetainer ||
				deliverable.approvedDay === null ||
				isInLastDays(deliverable.approvedDay, RETAINER_BOARD_DAYS),
		)
		.sort((first, second) => first.dueDay.localeCompare(second.dueDay))
		.map((deliverable) => ({
			...deliverable,
			ownerName: memberName.get(deliverable.ownerId) ?? "",
			priority:
				deliverable.status === "approved"
					? null
					: priorityOf(deliverable.dueDay),
		}));

	return { project, people, items };
}
