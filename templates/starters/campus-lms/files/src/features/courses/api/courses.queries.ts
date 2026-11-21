// Reads of courses: the list with the seat and lesson figures, and one course with its modules, students, work, and events.
// The /app/courses loader prefetches the list and the first course; the course page loader prefetches its course.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	type AssignmentKind,
	averageOf,
	buildLearningIndex,
	type CourseLevel,
	type CourseRow,
	type CourseStatus,
	courseLengthDays,
	courseStatusOf,
	courseWeekOf,
	getSampleTables,
	type LearnerState,
	type LearningIndex,
	learnerKey,
	learnerStateOf,
	lessonCountOf,
	lessonsReleasedOf,
	type SampleTables,
	type Track,
} from "~/features/school";

/** One course with the figures that a card shows. The times are ISO texts. */
export type Course = {
	/** A slug, for example "sql-and-data-modeling". It is the `$courseId` of the URL. */
	id: string;
	/** The catalog code, for example "DAT-205". */
	code: string;
	title: string;
	track: Track;
	level: CourseLevel;
	status: CourseStatus;
	instructorName: string;
	/** Weekday numbers of the classes. 0 is Sunday. */
	classDays: number[];
	/** Start of each class as "HH:MM". */
	classTime: string;
	startAt: string;
	endAt: string;
	/** The places of the course. */
	seats: number;
	/** Count of students in the course. */
	enrolled: number;
	/** Count of all lessons. */
	lessonCount: number;
	/** Count of lessons that are open to the students at this time. */
	lessonsReleased: number;
	/** The week of the course today, from 1. 0 before the first day. */
	week: number;
	/** The length of the course in weeks. */
	weeks: number;
	/** Count of students with the certificate. Above 0 only for a finished course. */
	certificates: number;
	/** Count of submissions that wait for a grade. */
	toGrade: number;
};

/** One module of a course with its release and its progress. */
export type CourseModule = {
	title: string;
	/** Count of lessons in the module. */
	lessons: number;
	/** How many of them are open to the students. */
	released: number;
	/** The day the first lesson of the module opens (ISO). */
	opensAt: string;
	/** Share of the open lessons that the students finished, 0 to 1. null while no lesson is open. */
	doneShare: number | null;
};

/** One student of a course with the progress numbers. `id` is the student id. */
export type Learner = {
	id: string;
	name: string;
	email: string;
	/** Count of lessons that the student finished. */
	done: number;
	state: LearnerState;
	/** The mean grade in this course, in points of 100. null with no grade yet. */
	averageGrade: number | null;
	/** The newest lesson or submission time of the student in this course. null with no activity here. */
	lastActiveAt: string | null;
	enrolledAt: string;
};

/** One assignment of a course with its counts. */
export type CourseAssignment = {
	id: string;
	title: string;
	kind: AssignmentKind;
	/** 23:59 on the due day. */
	dueAt: string;
	/** Count of students who sent their work. */
	submitted: number;
	/** Count of submissions with a grade. */
	graded: number;
	/** The mean grade in points. null with no grade yet. */
	averagePoints: number | null;
	/** "open" before the due day ends; after it, "to_grade" while work waits, else "graded". */
	state: CourseAssignmentState;
};

/** The states of an assignment in the course tables. The label is `courses.assignmentStates.<state>`. */
export const COURSE_ASSIGNMENT_STATES = ["open", "to_grade", "graded"] as const;

/** One assignment state. */
export type CourseAssignmentState = (typeof COURSE_ASSIGNMENT_STATES)[number];

/** One event of the course feed: who did what, and when. */
export type CourseEvent = {
	/** Unique in the feed. */
	id: string;
	studentName: string;
	occurredAt: string;
} & (
	| {
			/** The student finished the last lesson of a module. Single lessons stay out: they would fill the feed. */
			kind: "module";
			moduleTitle: string;
	  }
	| {
			kind: "submission";
			assignmentTitle: string;
			/** The id of the work. The feed links to it on the Assignments page. */
			submissionId: string;
	  }
	| {
			kind: "grade";
			assignmentTitle: string;
			/** The id of the graded work. */
			submissionId: string;
			/** The grade in points. */
			points: number;
	  }
	| { kind: "enrollment" }
);

/** One course with the records that only its own page shows. */
export type CourseDetail = Course & {
	/** Two sentences about the course. */
	summary: string;
	instructor: { name: string; title: string };
	/** Sum of the lessons that all students finished. */
	lessonsDone: number;
	/** Count of all submissions of the course. */
	submissions: number;
	/** Count of submissions with a grade. */
	graded: number;
	modules: CourseModule[];
	/** The students of the course, by name. */
	learners: Learner[];
	/** The assignments in due order. */
	assignments: CourseAssignment[];
	/** The newest events of the course, at most 3 of each kind and 8 in all, newest first. */
	events: CourseEvent[];
};

// The list shows the courses of today first, then the next ones, then the finished ones.
const STATUS_ORDER = { running: 0, upcoming: 1, completed: 2 } as const;
// The feed of the course page shows this many events.
const EVENT_COUNT = 5;
// The feed keeps this many events of one kind, so a mix of kinds shows.
const EVENTS_PER_KIND = 3;

// The card figures of one course. A database view does these joins later.
function summarize(
	course: CourseRow,
	tables: SampleTables,
	index: LearningIndex,
	now: number,
): Course {
	const status = courseStatusOf(course, now);
	const lessonCount = lessonCountOf(course);
	const lessonsReleased = lessonsReleasedOf(course, now);
	const members = tables.enrollments.filter(
		(row) => row.courseId === course.id,
	);
	const assignmentIds = new Set(
		tables.assignments
			.filter((row) => row.courseId === course.id)
			.map((row) => row.id),
	);
	return {
		id: course.id,
		code: course.code,
		title: course.title,
		track: course.track,
		level: course.level,
		status,
		instructorName:
			tables.instructors.find((row) => row.id === course.instructorId)?.name ??
			"",
		classDays: course.classDays,
		classTime: course.classTime,
		startAt: course.startAt,
		endAt: course.endAt,
		seats: course.seats,
		enrolled: members.length,
		lessonCount,
		lessonsReleased,
		...courseWeekOf(course, now),
		certificates: members.filter(
			(row) =>
				learnerStateOf(
					status,
					index.lessonsDone.get(learnerKey(row.studentId, course.id)) ?? 0,
					lessonsReleased,
					lessonCount,
				) === "certified",
		).length,
		toGrade: tables.submissions.filter(
			(row) => assignmentIds.has(row.assignmentId) && row.gradedAt === null,
		).length,
	};
}

/** The course that the Courses page shows first: the first running course, else the first of the list. undefined with no course. */
export function featuredCourseId(courses: Course[]): string | undefined {
	return (courses.find((course) => course.status === "running") ?? courses[0])
		?.id;
}

/** Every course: the running ones by first day, then the next ones, then the finished ones, newest first. */
export function coursesQueryOptions() {
	return queryOptions({
		queryKey: ["courses", "list"],
		queryFn: async () => {
			const now = Date.now();
			const tables = getSampleTables(now);
			const index = buildLearningIndex(tables);
			return tables.courses
				.map((course) => summarize(course, tables, index, now))
				.sort(
					(first, second) =>
						STATUS_ORDER[first.status] - STATUS_ORDER[second.status] ||
						(first.status === "completed"
							? second.endAt.localeCompare(first.endAt)
							: first.startAt.localeCompare(second.startAt)),
				);
		},
	});
}

// The modules of a course with their open lessons and the share that the students finished.
function modulesOf(
	course: CourseRow,
	lessonsReleased: number,
	lessonsDoneByLearner: number[],
): CourseModule[] {
	const lessonCount = lessonCountOf(course);
	const lengthDays = courseLengthDays(course);
	let firstLesson = 0;
	return course.modules.map((module) => {
		const start = firstLesson;
		firstLesson += module.lessons;
		const released = Math.min(
			module.lessons,
			Math.max(0, lessonsReleased - start),
		);
		// A student does the lessons in order, so `done` lessons are the first `done` lessons of the course.
		const doneInModule = lessonsDoneByLearner.reduce(
			(sum, done) => sum + Math.min(released, Math.max(0, done - start)),
			0,
		);
		const opensAt = new Date(course.startAt);
		// The same pace as lessonsReleasedOf: lesson k opens on day floor(k * days / lessons).
		opensAt.setDate(
			opensAt.getDate() + Math.floor((start * lengthDays) / lessonCount),
		);
		return {
			title: module.title,
			lessons: module.lessons,
			released,
			opensAt: opensAt.toISOString(),
			doneShare:
				released > 0 && lessonsDoneByLearner.length > 0
					? doneInModule / (released * lessonsDoneByLearner.length)
					: null,
		};
	});
}

/** One course with its modules, students, assignments, and newest events. null when the id does not exist. */
export function courseQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["courses", "detail", id],
		queryFn: async (): Promise<CourseDetail | null> => {
			const now = Date.now();
			const tables = getSampleTables(now);
			const course = tables.courses.find((row) => row.id === id);
			// The id comes from the URL. An unknown id is "not found", not an error.
			if (!course) {
				return null;
			}
			const index = buildLearningIndex(tables);
			const summary = summarize(course, tables, index, now);
			const instructor = tables.instructors.find(
				(row) => row.id === course.instructorId,
			);
			const students = new Map(tables.students.map((row) => [row.id, row]));
			const assignments = tables.assignments.filter(
				(row) => row.courseId === id,
			);
			const assignmentTitles = new Map(
				assignments.map((row) => [row.id, row.title]),
			);
			const submissions = tables.submissions.filter((row) =>
				assignmentTitles.has(row.assignmentId),
			);

			const learners: Learner[] = tables.enrollments
				.filter((row) => row.courseId === id)
				.flatMap((row) => {
					const student = students.get(row.studentId);
					if (!student) {
						return [];
					}
					const done = index.lessonsDone.get(learnerKey(student.id, id)) ?? 0;
					return [
						{
							id: student.id,
							name: student.name,
							email: student.email,
							done,
							state: learnerStateOf(
								summary.status,
								done,
								summary.lessonsReleased,
								summary.lessonCount,
							),
							averageGrade: averageOf(
								submissions.flatMap((item) =>
									item.studentId === student.id && item.points !== null
										? [item.points]
										: [],
								),
							),
							lastActiveAt:
								index.lastActiveInCourse.get(learnerKey(student.id, id)) ??
								null,
							enrolledAt: row.enrolledAt,
						},
					];
				})
				.sort((first, second) => first.name.localeCompare(second.name));

			const nameOf = (studentId: string) => students.get(studentId)?.name ?? "";
			// The number of the last lesson of each module, to the module title.
			const moduleEnds = new Map<number, string>();
			let lessonTotal = 0;
			for (const module of course.modules) {
				lessonTotal += module.lessons;
				moduleEnds.set(lessonTotal, module.title);
			}
			// The count of events of each kind that the feed saw so far, newest first.
			const seenPerKind = new Map<CourseEvent["kind"], number>();
			const events: CourseEvent[] = [
				...tables.lessonCompletions.flatMap((row) => {
					const moduleTitle = moduleEnds.get(row.lesson);
					return row.courseId === id && moduleTitle !== undefined
						? [
								{
									id: `module-${row.studentId}-${row.lesson}`,
									kind: "module" as const,
									studentName: nameOf(row.studentId),
									moduleTitle,
									occurredAt: row.completedAt,
								},
							]
						: [];
				}),
				...submissions.map((row) => ({
					id: `submission-${row.id}`,
					kind: "submission" as const,
					studentName: nameOf(row.studentId),
					assignmentTitle: assignmentTitles.get(row.assignmentId) ?? "",
					submissionId: row.id,
					occurredAt: row.submittedAt,
				})),
				...submissions.flatMap((row) =>
					row.gradedAt !== null && row.points !== null
						? [
								{
									id: `grade-${row.id}`,
									kind: "grade" as const,
									studentName: nameOf(row.studentId),
									assignmentTitle: assignmentTitles.get(row.assignmentId) ?? "",
									submissionId: row.id,
									points: row.points,
									occurredAt: row.gradedAt,
								},
							]
						: [],
				),
				...tables.enrollments
					.filter((row) => row.courseId === id)
					.map((row) => ({
						id: `enrollment-${row.id}`,
						kind: "enrollment" as const,
						studentName: nameOf(row.studentId),
						occurredAt: row.enrolledAt,
					})),
			]
				.sort((first, second) =>
					second.occurredAt.localeCompare(first.occurredAt),
				)
				// A busy kind must not hide the others: the feed keeps the 3 newest events of each kind.
				.filter((event) => {
					const seen = seenPerKind.get(event.kind) ?? 0;
					seenPerKind.set(event.kind, seen + 1);
					return seen < EVENTS_PER_KIND;
				})
				.slice(0, EVENT_COUNT);

			return {
				...summary,
				summary: course.summary,
				instructor: {
					name: instructor?.name ?? "",
					title: instructor?.title ?? "",
				},
				lessonsDone: learners.reduce((sum, learner) => sum + learner.done, 0),
				submissions: submissions.length,
				graded: submissions.filter((row) => row.gradedAt !== null).length,
				modules: modulesOf(
					course,
					summary.lessonsReleased,
					learners.map((learner) => learner.done),
				),
				learners,
				assignments: assignments
					.map((assignment) => {
						const work = submissions.filter(
							(row) => row.assignmentId === assignment.id,
						);
						const graded = work.filter((row) => row.gradedAt !== null).length;
						return {
							id: assignment.id,
							title: assignment.title,
							kind: assignment.kind,
							dueAt: assignment.dueAt,
							submitted: work.length,
							graded,
							averagePoints: averageOf(
								work.flatMap((row) =>
									row.points === null ? [] : [row.points],
								),
							),
							state:
								Date.parse(assignment.dueAt) > now
									? "open"
									: graded < work.length
										? "to_grade"
										: "graded",
						} satisfies CourseAssignment;
					})
					.sort((first, second) => first.dueAt.localeCompare(second.dueAt)),
				events,
			};
		},
	});
}
