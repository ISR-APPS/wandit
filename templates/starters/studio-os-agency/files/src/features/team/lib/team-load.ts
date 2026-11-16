// The load of each studio member over a period: billable hours, studio time, capacity, and utilization.
// teamLoadQueryOptions calls it inside its queryFn. The Team page and the overview Team tab show the rows.
import {
	type Day,
	daysBetween,
	isInLastDays,
	type Role,
	type StudioData,
	workdaysInLastDays,
} from "~/features/studio";

/** The hours of one member on one project in the period. */
export type ProjectHours = {
	projectId: string;
	projectName: string;
	clientName: string;
	hours: number;
};

/** One recent day of a member's timesheet. */
export type TimesheetDay = {
	day: Day;
	billable: number;
	studio: number;
};

/** The load of one member over the period. */
export type MemberLoad = {
	id: string;
	name: string;
	role: Role;
	/** Contract hours per week. */
	weeklyCapacity: number;
	/** Contract hours in the workdays of the period. */
	capacity: number;
	/** Hours on client projects in the period. */
	billable: number;
	/** Hours on internal work, pitches, and admin in the period. */
	studio: number;
	/** billable / capacity. Above 1 means overtime. */
	utilization: number;
	/** Projects with hours in the period, most hours first. */
	projects: ProjectHours[];
	/** The last 10 workdays with hours, newest first. */
	recentDays: TimesheetDay[];
};

/** The load of every member over the last `days` complete days, in catalog order. */
export function buildTeamLoad(data: StudioData, days: number): MemberLoad[] {
	const workdays = workdaysInLastDays(days);
	const projectOf = new Map(
		data.projects.map((project) => [project.id, project]),
	);
	const clientName = new Map(
		data.clients.map((client) => [client.id, client.name]),
	);
	return data.members.map((member) => {
		// Capacity per workday: a 32-hour contract gives 6.4 hours.
		const capacity = (member.weeklyCapacity / 5) * workdays;
		const own = data.entries.filter((entry) => entry.memberId === member.id);
		const inPeriod = own.filter((entry) => isInLastDays(entry.day, days));
		const billable = inPeriod
			.filter((entry) => entry.projectId !== null)
			.reduce((sum, entry) => sum + entry.hours, 0);
		const hoursByProject = new Map<string, number>();
		for (const entry of inPeriod) {
			if (entry.projectId !== null) {
				hoursByProject.set(
					entry.projectId,
					(hoursByProject.get(entry.projectId) ?? 0) + entry.hours,
				);
			}
		}
		const byDay = new Map<Day, TimesheetDay>();
		for (const entry of own) {
			const row = byDay.get(entry.day) ?? {
				day: entry.day,
				billable: 0,
				studio: 0,
			};
			if (entry.projectId === null) {
				row.studio += entry.hours;
			} else {
				row.billable += entry.hours;
			}
			byDay.set(entry.day, row);
		}
		return {
			id: member.id,
			name: member.name,
			role: member.role,
			weeklyCapacity: member.weeklyCapacity,
			capacity,
			billable,
			studio: inPeriod
				.filter((entry) => entry.projectId === null)
				.reduce((sum, entry) => sum + entry.hours, 0),
			utilization: capacity === 0 ? 0 : billable / capacity,
			projects: [...hoursByProject.entries()]
				.map(([projectId, hours]) => {
					const project = projectOf.get(projectId);
					return {
						projectId,
						projectName: project?.name ?? "",
						clientName: clientName.get(project?.clientId ?? "") ?? "",
						hours,
					};
				})
				.sort((first, second) => second.hours - first.hours),
			recentDays: [...byDay.values()]
				.sort((first, second) => daysBetween(first.day, second.day))
				.slice(0, 10),
		};
	});
}
