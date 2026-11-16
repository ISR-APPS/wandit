// Reads of graded work: the submission list, one submission with its history, and the assignments that are due next.
// The /app/assignments loader prefetches the lists. The home reads the list for its grading section.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	type AssignmentKind,
	courseStatusOf,
	getSampleTables,
	type SampleTables,
	type SubmissionRow,
	type SubmissionStatus,
	startOfLocalDay,
	type WaitBand,
	waitBandOf,
} from "~/features/school";

/** One submission with the names that a list shows. The times are ISO texts. */
export type Submission = {
	id: string;
	assignmentId: string;
	assignmentTitle: string;
	kind: AssignmentKind;
	courseId: string;
	/** The catalog code of the course, for example "DAT-205". */
	courseCode: string;
	courseTitle: string;
	studentId: string;
	studentName: string;
	submittedAt: string;
	/** 23:59 on the due day of the assignment. */
	dueAt: string;
	/** True when the student sent the work after `dueAt`. */
	isLate: boolean;
	status: SubmissionStatus;
	/** null while the submission waits for its grade. */
	gradedAt: string | null;
	/** The grade in points. null while the submission waits. */
	points: number | null;
	/** The highest grade of the assignment, in points. */
	maxPoints: number;
	/** How long the submission waits. null when it has its grade. */
	waitBand: WaitBand | null;
};

/** One submission with the records that only its side panel shows. */
export type SubmissionDetail = Submission & {
	/** The message of the student. null when the student wrote none. */
	note: string | null;
	/** The comment of the instructor. null while the submission waits. */
	feedback: string | null;
	/** The instructor who grades the course. */
	instructorName: string;
	/** The other submissions of the same student in the same course, newest first. */
	otherWork: Submission[];
};

/** One assignment that is due today or later, with its turn-in count. */
export type UpcomingAssignment = {
	id: string;
	title: string;
	kind: AssignmentKind;
	courseId: string;
	courseCode: string;
	dueAt: string;
	/** How many students sent their work. */
	submitted: number;
	/** How many students are in the course. */
	expected: number;
};

// Adds the assignment, course, and student names to submission rows. A database join does this later.
function withNames(
	rows: SubmissionRow[],
	tables: SampleTables,
	now: number,
): Submission[] {
	const assignments = new Map(tables.assignments.map((row) => [row.id, row]));
	const courses = new Map(tables.courses.map((row) => [row.id, row]));
	const students = new Map(tables.students.map((row) => [row.id, row]));
	return rows.flatMap((row) => {
		const assignment = assignments.get(row.assignmentId);
		const course = courses.get(assignment?.courseId ?? "");
		const student = students.get(row.studentId);
		// A submission always has its assignment, its course, and its student. A row without one is skipped.
		if (!assignment || !course || !student) {
			return [];
		}
		const isGraded = row.gradedAt !== null;
		return [
			{
				id: row.id,
				assignmentId: assignment.id,
				assignmentTitle: assignment.title,
				kind: assignment.kind,
				courseId: course.id,
				courseCode: course.code,
				courseTitle: course.title,
				studentId: student.id,
				studentName: student.name,
				submittedAt: row.submittedAt,
				dueAt: assignment.dueAt,
				isLate: row.submittedAt > assignment.dueAt,
				status: isGraded ? "graded" : "to_grade",
				gradedAt: row.gradedAt,
				points: row.points,
				maxPoints: assignment.maxPoints,
				waitBand: isGraded ? null : waitBandOf(row.submittedAt, now),
			} satisfies Submission,
		];
	});
}

/** Every submission, newest first. The Assignments page filters, sorts, and pages them. The home counts the ones that wait. */
export function submissionsQueryOptions() {
	return queryOptions({
		queryKey: ["submissions", "list"],
		queryFn: async () => {
			const now = Date.now();
			const tables = getSampleTables(now);
			// LIMIT: every submission in one read, paged in the browser. Upgrade: a limit of 1,000 with server paging (tables-paging.md of the app-dashboard skill).
			return withNames(tables.submissions, tables, now).sort((first, second) =>
				second.submittedAt.localeCompare(first.submittedAt),
			);
		},
	});
}

/** One submission with its note, its feedback, and the other work of the student in the course. null when the id does not exist. */
export function submissionQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["submissions", "detail", id],
		queryFn: async (): Promise<SubmissionDetail | null> => {
			const now = Date.now();
			const tables = getSampleTables(now);
			const row = tables.submissions.find((item) => item.id === id);
			// The id comes from the URL. An unknown id is "not found", not an error.
			const [submission] = row ? withNames([row], tables, now) : [];
			if (!row || !submission) {
				return null;
			}
			const course = tables.courses.find(
				(item) => item.id === submission.courseId,
			);
			const instructor = tables.instructors.find(
				(item) => item.id === course?.instructorId,
			);
			const courseAssignmentIds = new Set(
				tables.assignments
					.filter((item) => item.courseId === submission.courseId)
					.map((item) => item.id),
			);
			return {
				...submission,
				note: row.note,
				feedback: row.feedback,
				instructorName: instructor?.name ?? "",
				otherWork: withNames(
					tables.submissions.filter(
						(item) =>
							item.id !== id &&
							item.studentId === row.studentId &&
							courseAssignmentIds.has(item.assignmentId),
					),
					tables,
					now,
				).sort((first, second) =>
					second.submittedAt.localeCompare(first.submittedAt),
				),
			};
		},
	});
}

// The "Due next" card shows this many assignments.
const DUE_NEXT_COUNT = 5;

/** The 5 next assignments of the running courses, by due day, with the count of work that is in. */
export function dueNextQueryOptions() {
	return queryOptions({
		queryKey: ["submissions", "due-next"],
		queryFn: async (): Promise<UpcomingAssignment[]> => {
			const now = Date.now();
			const tables = getSampleTables(now);
			const today = startOfLocalDay(now);
			const courses = new Map(tables.courses.map((row) => [row.id, row]));
			return tables.assignments
				.flatMap((assignment) => {
					const course = courses.get(assignment.courseId);
					// An assignment that is due today stays in the list until midnight.
					if (
						!course ||
						courseStatusOf(course, now) !== "running" ||
						Date.parse(assignment.dueAt) < today
					) {
						return [];
					}
					return [
						{
							id: assignment.id,
							title: assignment.title,
							kind: assignment.kind,
							courseId: course.id,
							courseCode: course.code,
							dueAt: assignment.dueAt,
							submitted: tables.submissions.filter(
								(row) => row.assignmentId === assignment.id,
							).length,
							expected: tables.enrollments.filter(
								(row) => row.courseId === course.id,
							).length,
						},
					];
				})
				.sort((first, second) => first.dueAt.localeCompare(second.dueAt))
				.slice(0, DUE_NEXT_COUNT);
		},
	});
}
