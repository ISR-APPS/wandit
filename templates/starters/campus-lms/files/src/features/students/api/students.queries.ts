// Reads of students: the list with the state of each student, and one student with the courses and the graded work.
// The /app/students loader prefetches the list. The side panel reads one student after a click.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	averageOf,
	buildLearningIndex,
	type CourseStatus,
	courseStatusOf,
	getSampleTables,
	isInPeriod,
	type LearnerState,
	type LearningIndex,
	learnerKey,
	learnerStateOf,
	lessonCountOf,
	lessonsReleasedOf,
	type SampleTables,
	type StudentStatus,
	type SubmissionStatus,
} from "~/features/school";

/** One student in one course, with the progress numbers. */
export type StudentEnrollment = {
	courseId: string;
	courseTitle: string;
	/** The catalog code of the course, for example "UX-201". */
	courseCode: string;
	courseStatus: CourseStatus;
	state: LearnerState;
	/** Count of lessons that the student finished. */
	done: number;
	/** Count of lessons that are open to the students at this time. */
	released: number;
	/** Count of all lessons of the course. */
	lessonCount: number;
	enrolledAt: string;
};

/** One student with the figures that the list shows. The times are ISO texts. */
export type Student = {
	id: string;
	name: string;
	email: string;
	/** The time of the first enrollment. */
	joinedAt: string;
	status: StudentStatus;
	/** The course that the list shows: the running one, else the next one, else the last finished one. */
	mainCourse: StudentEnrollment;
	/** Count of all courses of the student, finished ones included. */
	courseCount: number;
	/** The mean grade over all graded work, in points of 100. null with no grade yet. */
	averageGrade: number | null;
	/** The newest lesson or submission time. null when the student did nothing yet. */
	lastActiveAt: string | null;
	/** True when the student finished a lesson or sent work in the last 7 days. */
	isActiveThisWeek: boolean;
};

/** One piece of work of a student, for the side panel. */
export type StudentWork = {
	/** The id of the submission. The panel links to it on the Assignments page. */
	id: string;
	assignmentTitle: string;
	courseCode: string;
	submittedAt: string;
	status: SubmissionStatus;
	/** null while the submission waits for its grade. */
	points: number | null;
	maxPoints: number;
};

/** One student with the records that only the side panel shows. */
export type StudentDetail = Student & {
	/** Every course of the student: running first, then upcoming, then finished. */
	enrollments: StudentEnrollment[];
	/** The 6 newest submissions of the student. */
	recentWork: StudentWork[];
};

// The order of the courses of one student: the one that runs today matters most.
const COURSE_STATUS_ORDER = { running: 0, upcoming: 1, completed: 2 } as const;
// The "active this week" figure looks at the last 7 days.
const ACTIVE_DAYS = 7;
// The side panel shows this many submissions.
const RECENT_WORK_COUNT = 6;

// The courses of one student with the progress numbers, in COURSE_STATUS_ORDER.
function enrollmentsOf(
	studentId: string,
	tables: SampleTables,
	index: LearningIndex,
	now: number,
): StudentEnrollment[] {
	return tables.enrollments
		.filter((row) => row.studentId === studentId)
		.flatMap((row) => {
			const course = tables.courses.find((item) => item.id === row.courseId);
			if (!course) {
				return [];
			}
			const courseStatus = courseStatusOf(course, now);
			const done = index.lessonsDone.get(learnerKey(studentId, course.id)) ?? 0;
			const released = lessonsReleasedOf(course, now);
			const lessonCount = lessonCountOf(course);
			return [
				{
					courseId: course.id,
					courseTitle: course.title,
					courseCode: course.code,
					courseStatus,
					state: learnerStateOf(courseStatus, done, released, lessonCount),
					done,
					released,
					lessonCount,
					enrolledAt: row.enrolledAt,
				},
			];
		})
		.sort(
			(first, second) =>
				COURSE_STATUS_ORDER[first.courseStatus] -
					COURSE_STATUS_ORDER[second.courseStatus] ||
				second.enrolledAt.localeCompare(first.enrolledAt),
		);
}

// The state of a student over all courses, from the main course: the first one in COURSE_STATUS_ORDER.
function studentStatusOf(mainCourse: StudentEnrollment): StudentStatus {
	if (mainCourse.courseStatus === "running") {
		return mainCourse.state === "behind" ? "behind" : "on_track";
	}
	return mainCourse.courseStatus === "upcoming" ? "starting" : "graduated";
}

// Every student with the list figures. A database view does these joins later.
function buildStudents(
	tables: SampleTables,
	index: LearningIndex,
	now: number,
): Student[] {
	const grades = new Map<string, number[]>();
	for (const row of tables.submissions) {
		if (row.points !== null) {
			grades.set(row.studentId, [
				...(grades.get(row.studentId) ?? []),
				row.points,
			]);
		}
	}
	return tables.students.flatMap((row) => {
		const enrollments = enrollmentsOf(row.id, tables, index, now);
		const [mainCourse] = enrollments;
		// A student row exists only with an enrollment. A row without one is skipped.
		if (!mainCourse) {
			return [];
		}
		const lastActiveAt = index.lastActiveAt.get(row.id) ?? null;
		return [
			{
				id: row.id,
				name: row.name,
				email: row.email,
				joinedAt: row.joinedAt,
				status: studentStatusOf(mainCourse),
				mainCourse,
				courseCount: enrollments.length,
				averageGrade: averageOf(grades.get(row.id) ?? []),
				lastActiveAt,
				isActiveThisWeek:
					lastActiveAt !== null && isInPeriod(lastActiveAt, ACTIVE_DAYS, now),
			},
		];
	});
}

/** Every student, by name. The Students page filters, sorts, and pages them. */
export function studentsQueryOptions() {
	return queryOptions({
		queryKey: ["students", "list"],
		queryFn: async () => {
			const now = Date.now();
			// LIMIT: every student in one read, paged in the browser. Upgrade: a limit of 1,000 with server paging (tables-paging.md of the app-dashboard skill).
			const tables = getSampleTables(now);
			return buildStudents(tables, buildLearningIndex(tables), now).sort(
				(first, second) => first.name.localeCompare(second.name),
			);
		},
	});
}

/** One student with every course and the newest work. null when the id does not exist. */
export function studentQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["students", "detail", id],
		queryFn: async (): Promise<StudentDetail | null> => {
			const now = Date.now();
			const tables = getSampleTables(now);
			// The id comes from the URL. An unknown id is "not found", not an error.
			const index = buildLearningIndex(tables);
			const student = buildStudents(tables, index, now).find(
				(row) => row.id === id,
			);
			if (!student) {
				return null;
			}
			const assignments = new Map(
				tables.assignments.map((row) => [row.id, row]),
			);
			const courses = new Map(tables.courses.map((row) => [row.id, row]));
			return {
				...student,
				enrollments: enrollmentsOf(id, tables, index, now),
				recentWork: tables.submissions
					.filter((row) => row.studentId === id)
					.sort((first, second) =>
						second.submittedAt.localeCompare(first.submittedAt),
					)
					.slice(0, RECENT_WORK_COUNT)
					.flatMap((row) => {
						const assignment = assignments.get(row.assignmentId);
						const course = courses.get(assignment?.courseId ?? "");
						return assignment && course
							? [
									{
										id: row.id,
										assignmentTitle: assignment.title,
										courseCode: course.code,
										submittedAt: row.submittedAt,
										status:
											row.gradedAt === null
												? ("to_grade" as const)
												: ("graded" as const),
										points: row.points,
										maxPoints: assignment.maxPoints,
									},
								]
							: [];
					}),
			};
		},
	});
}
