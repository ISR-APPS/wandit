// The progress rule of a project (done story points against all story points) and the time left to its target.
// The project cards, the project page, and the project tables of the home call them.
import { calendarDaysFromNow } from "~/features/tracker";
import type { Project } from "../api/projects.queries";

/** Done points against all points, as a whole percent from 0 to 100. A project with no task is at 0. */
export function progressOf(
	project: Pick<Project, "pointsDone" | "pointsTotal">,
): number {
	return project.pointsTotal === 0
		? 0
		: Math.round((project.pointsDone / project.pointsTotal) * 100);
}

/** The time state of a project for its badge: days left to the target, days past it, days to the start, or ended. */
export type ProjectTimeLeft =
	| { kind: "left"; days: number }
	| { kind: "late"; days: number }
	| { kind: "starts"; days: number }
	| { kind: "completed" }
	| { kind: "paused" };

/**
 * Calendar days between today and the target day of a running project. A planned project counts to its start.
 * A completed or a paused project has no time left.
 */
export function timeLeftOf(
	project: Pick<Project, "status" | "startAt" | "targetAt">,
	now: number,
): ProjectTimeLeft {
	if (project.status === "completed" || project.status === "paused") {
		return { kind: project.status };
	}
	if (project.status === "planned") {
		return {
			kind: "starts",
			days: Math.max(0, calendarDaysFromNow(project.startAt, now)),
		};
	}
	const days = calendarDaysFromNow(project.targetAt, now);
	return days < 0 ? { kind: "late", days: -days } : { kind: "left", days };
}
