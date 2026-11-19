// Reads of the header alerts: the work that waits past the grading promise, and the assignments due today or tomorrow.
// HeaderNotifications reads it after the shell renders. The wait rule is waitBandOf of lib/learning.ts,
// so the bell counts the same submissions as the "Over 5 days" filter of the Assignments page.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { courseStatusOf, waitBandOf } from "../lib/learning";
import { getSampleTables } from "../lib/sample-data";
import { calendarDaysFromNow } from "../lib/time";

// linkOptions types each path, so a wrong path fails typecheck.
function submissionLink(submissionId: string) {
	return linkOptions({
		to: "/app/assignments",
		search: { submission: submissionId },
	});
}

function courseLink(courseId: string) {
	return linkOptions({ to: "/app/courses/$courseId", params: { courseId } });
}

/** One alert of the bell menu. */
export type Alert = {
	id: string;
	/** "overdueGrading": a submission past the 5-day promise. "dueSoon": an assignment due today or tomorrow. */
	kind: "overdueGrading" | "dueSoon";
	/** The assignment title. */
	title: string;
	/** The student and the course code, or the course code alone. */
	detail: string;
	/** ISO time: when the work came in, or when the assignment is due. */
	at: string;
	link: ReturnType<typeof submissionLink> | ReturnType<typeof courseLink>;
};

// "Due soon" means today or tomorrow, in calendar days.
const DUE_SOON_DAYS = 1;

/** Every alert: the late grading first, the oldest first, then the deadlines. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const now = Date.now();
			const tables = getSampleTables(now);
			const assignments = new Map(
				tables.assignments.map((row) => [row.id, row]),
			);
			const courses = new Map(tables.courses.map((row) => [row.id, row]));
			const students = new Map(tables.students.map((row) => [row.id, row]));
			const overdueGrading: Alert[] = tables.submissions
				.filter(
					(row) =>
						row.gradedAt === null &&
						waitBandOf(row.submittedAt, now) === "overdue",
				)
				.sort((first, second) =>
					first.submittedAt.localeCompare(second.submittedAt),
				)
				.map((row) => {
					const assignment = assignments.get(row.assignmentId);
					const course = courses.get(assignment?.courseId ?? "");
					return {
						id: row.id,
						kind: "overdueGrading",
						title: assignment?.title ?? "",
						detail: `${students.get(row.studentId)?.name ?? ""} · ${course?.code ?? ""}`,
						at: row.submittedAt,
						link: submissionLink(row.id),
					};
				});
			const dueSoon: Alert[] = tables.assignments
				.filter((row) => {
					const course = courses.get(row.courseId);
					const days = calendarDaysFromNow(row.dueAt, now);
					return (
						course !== undefined &&
						courseStatusOf(course, now) === "running" &&
						days >= 0 &&
						days <= DUE_SOON_DAYS
					);
				})
				.sort((first, second) => first.dueAt.localeCompare(second.dueAt))
				.map((row) => ({
					id: row.id,
					kind: "dueSoon",
					title: row.title,
					detail: courses.get(row.courseId)?.code ?? "",
					at: row.dueAt,
					link: courseLink(row.courseId),
				}));
			return [...overdueGrading, ...dueSoon];
		},
	});
}
