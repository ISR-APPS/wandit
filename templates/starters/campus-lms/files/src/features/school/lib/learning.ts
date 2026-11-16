// The rules of the school as pure functions: the state of a course, the released lessons, the state of a student,
// and the wait of a submission. Every query file calls them, so all pages give the same answer for the same rows.
// A later database keeps these rules in SQL views or read functions.
import {
	BEHIND_AFTER_LESSONS,
	CERTIFICATE_SHARE,
	type CourseStatus,
	FRESH_WAIT_DAYS,
	GRADING_TARGET_DAYS,
	type LearnerState,
	type WaitBand,
} from "./catalog";
import {
	type CourseRow,
	lessonCountOf,
	type SampleTables,
} from "./sample-data";
import { calendarDaysFromNow, DAY_MS } from "./time";

/** The state of a course at `now`, from its first and last day. */
export function courseStatusOf(
	course: Pick<CourseRow, "startAt" | "endAt">,
	now: number,
): CourseStatus {
	if (now < Date.parse(course.startAt)) {
		return "upcoming";
	}
	return now > Date.parse(course.endAt) ? "completed" : "running";
}

/** The length of a course in whole days, from the first day to the last day. */
export function courseLengthDays(
	course: Pick<CourseRow, "startAt" | "endAt">,
): number {
	return Math.round(
		(Date.parse(course.endAt) - Date.parse(course.startAt)) / DAY_MS,
	);
}

/**
 * How many lessons of a course are open to its students at `now`.
 * The lessons open at an even pace from the first day to the last day, each at midnight.
 */
export function lessonsReleasedOf(course: CourseRow, now: number): number {
	const lessonCount = lessonCountOf(course);
	const dayOfCourse = -calendarDaysFromNow(course.startAt, now);
	if (dayOfCourse < 0) {
		return 0;
	}
	return Math.min(
		lessonCount,
		Math.ceil(((dayOfCourse + 1) * lessonCount) / courseLengthDays(course)),
	);
}

/** The week of a course at `now`, from 1 to `weeks`. 0 before the first day. */
export function courseWeekOf(
	course: Pick<CourseRow, "startAt" | "endAt">,
	now: number,
): { week: number; weeks: number } {
	const weeks = Math.round(courseLengthDays(course) / 7);
	const dayOfCourse = -calendarDaysFromNow(course.startAt, now);
	return {
		week:
			dayOfCourse < 0 ? 0 : Math.min(weeks, Math.floor(dayOfCourse / 7) + 1),
		weeks,
	};
}

/**
 * The state of a student in one course.
 * `done` is the count of finished lessons, `released` the count of open lessons, `lessonCount` all lessons.
 */
export function learnerStateOf(
	status: CourseStatus,
	done: number,
	released: number,
	lessonCount: number,
): LearnerState {
	if (status === "upcoming") {
		return "enrolled";
	}
	if (status === "completed") {
		// Product rule: the certificate needs 80 % of the lessons.
		return done >= lessonCount * CERTIFICATE_SHARE ? "certified" : "incomplete";
	}
	// Product rule: 4 open lessons that are not done make a student "behind".
	return released - done >= BEHIND_AFTER_LESSONS ? "behind" : "on_track";
}

/** Whole calendar days that a submission waits at `now`. 0 on the day of the submission. */
export function waitDaysOf(submittedAt: string, now: number): number {
	return Math.max(0, -calendarDaysFromNow(submittedAt, now));
}

/** The waiting band of a submission with no grade: under 2 days, up to the 5-day target, or over it. */
export function waitBandOf(submittedAt: string, now: number): WaitBand {
	const days = waitDaysOf(submittedAt, now);
	if (days < FRESH_WAIT_DAYS) {
		return "fresh";
	}
	return days > GRADING_TARGET_DAYS ? "overdue" : "waiting";
}

/** The key of one student in one course, for the maps of LearningIndex. */
export function learnerKey(studentId: string, courseId: string): string {
	return `${studentId}|${courseId}`;
}

/** Lookups that several queries need: the lessons done per learner and the last sign of life per student and per learner. */
export type LearningIndex = {
	/** Count of finished lessons, by learnerKey(studentId, courseId). No entry means 0. */
	lessonsDone: Map<string, number>;
	/** The newest lesson or submission time (ISO) of each student, by student id. No entry means no activity yet. */
	lastActiveAt: Map<string, string>;
	/** The newest lesson or submission time (ISO) of a student in one course, by learnerKey(studentId, courseId). */
	lastActiveInCourse: Map<string, string>;
};

/** Builds the lookups in one pass over the lesson and submission rows. */
export function buildLearningIndex(tables: SampleTables): LearningIndex {
	const lessonsDone = new Map<string, number>();
	const lastActiveAt = new Map<string, string>();
	const lastActiveInCourse = new Map<string, string>();
	const courseOfAssignment = new Map(
		tables.assignments.map((row) => [row.id, row.courseId]),
	);
	const touch = (map: Map<string, string>, key: string, time: string) => {
		const known = map.get(key);
		// ISO texts in UTC sort like their times.
		if (known === undefined || time > known) {
			map.set(key, time);
		}
	};
	for (const row of tables.lessonCompletions) {
		const key = learnerKey(row.studentId, row.courseId);
		lessonsDone.set(key, (lessonsDone.get(key) ?? 0) + 1);
		touch(lastActiveAt, row.studentId, row.completedAt);
		touch(lastActiveInCourse, key, row.completedAt);
	}
	for (const row of tables.submissions) {
		touch(lastActiveAt, row.studentId, row.submittedAt);
		const courseId = courseOfAssignment.get(row.assignmentId);
		if (courseId !== undefined) {
			touch(
				lastActiveInCourse,
				learnerKey(row.studentId, courseId),
				row.submittedAt,
			);
		}
	}
	return { lessonsDone, lastActiveAt, lastActiveInCourse };
}

/** The mean of `values`, or null for an empty list: a student with no grade has no average. */
export function averageOf(values: number[]): number | null {
	return values.length === 0
		? null
		: values.reduce((sum, value) => sum + value, 0) / values.length;
}
