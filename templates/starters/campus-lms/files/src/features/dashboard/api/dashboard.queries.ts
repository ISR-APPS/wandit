// Reads of the home: the summary of the school for the welcome, progress, leaderboard, pass rate,
// grading, and activity cards, and the lessons finished per day for the trend card.
// The /app loader prefetches both. The trend card reads another period after a click.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase rpc that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	buildDailySeries,
	courseStatusOf,
	GRADING_TARGET_DAYS,
	getSampleTables,
	isInPeriod,
	lessonsReleasedOf,
	PASS_POINTS,
	startOfLocalDay,
	type Track,
	waitBandOf,
	waitDaysOf,
} from "~/features/school";

/** 30 days. The pass rate and the activity mix compare this window with the one before it. */
export const SUMMARY_WINDOW_DAYS = 30;

// The last moment of yesterday: one millisecond before the local midnight of today.
// The lessons trend and the activity mix end here. Today has only some hours of data, so its point drops near zero.
function endOfYesterday(now: number): number {
	return startOfLocalDay(now) - 1;
}

/** One running course with its module progress, for the "Course progress" card. */
export type CoursePath = {
	id: string;
	title: string;
	/** The catalog code, for example "DAT-205". */
	code: string;
	track: Track;
	/** Count of modules whose lessons are all open. */
	modulesOpen: number;
	moduleCount: number;
};

/** One student of the leaderboard. */
export type Leader = {
	id: string;
	name: string;
	/** Sum of the grade points of the student in the running courses. */
	points: number;
};

/** One class of today: a running course that meets on the weekday of today. */
export type ClassToday = {
	courseId: string;
	code: string;
	title: string;
	/** Start of the class as "HH:MM", in the school time zone. */
	classTime: string;
};

/** Every figure of the home cards except the trend. Counts are whole numbers; shares are 0 to 1. */
export type DashboardSummary = {
	/** Count of courses with the status running. */
	runningCourses: number;
	/** Count of submissions with no grade, in every course. */
	toGrade: number;
	classesToday: ClassToday[];
	/** The 2 running courses that started first. */
	paths: CoursePath[];
	/** The 4 students with the most grade points in the running courses. */
	leaders: Leader[];
	passRate: {
		/** Share of the work graded in the last 30 days that scored PASS_POINTS or more. null with no graded work. */
		current: number | null;
		/** The same share for the 30 days before. null with no graded work then. */
		previous: number | null;
		/** Count of work graded in the last 30 days. */
		graded: number;
		/** How many of them passed. */
		passed: number;
	};
	/** The work of the running courses. */
	grading: {
		submitted: number;
		graded: number;
		toGrade: number;
		/** Graded work that got its grade inside the 5-day promise. */
		gradedOnTime: number;
		/** Work with no grade that waits past the 5-day promise. */
		overdue: number;
	};
	/** Counts of the last 30 full days, for the activity donut. The lessons count equals the 30-day trend total. */
	activity: { lessons: number; submissions: number; enrollments: number };
};

// The progress card shows 2 courses, the leaderboard 4 students.
const PATH_COUNT = 2;
const LEADER_COUNT = 4;

/** The summary of the school today. */
export function dashboardSummaryQueryOptions() {
	return queryOptions({
		queryKey: ["dashboard", "summary"],
		queryFn: async (): Promise<DashboardSummary> => {
			const now = Date.now();
			const tables = getSampleTables(now);
			const running = tables.courses.filter(
				(course) => courseStatusOf(course, now) === "running",
			);
			const runningIds = new Set(running.map((course) => course.id));
			const assignments = new Map(
				tables.assignments.map((row) => [row.id, row]),
			);
			const runningWork = tables.submissions.filter((row) =>
				runningIds.has(assignments.get(row.assignmentId)?.courseId ?? ""),
			);
			const gradedWork = runningWork.filter((row) => row.gradedAt !== null);
			const weekday = new Date(now).getDay();
			const lastFullDay = endOfYesterday(now);

			const pointsByStudent = new Map<string, number>();
			for (const row of gradedWork) {
				pointsByStudent.set(
					row.studentId,
					(pointsByStudent.get(row.studentId) ?? 0) + (row.points ?? 0),
				);
			}
			const names = new Map(tables.students.map((row) => [row.id, row.name]));

			// The pass rate of one window: the work graded in it, and the share at or above the pass mark.
			const passOf = (isInWindow: (gradedAt: string) => boolean) => {
				const graded = tables.submissions.filter(
					(row) => row.gradedAt !== null && isInWindow(row.gradedAt),
				);
				const passed = graded.filter(
					(row) => (row.points ?? 0) >= PASS_POINTS,
				).length;
				return { graded: graded.length, passed };
			};
			const current = passOf((at) => isInPeriod(at, SUMMARY_WINDOW_DAYS, now));
			const previous = passOf(
				(at) =>
					isInPeriod(at, 2 * SUMMARY_WINDOW_DAYS, now) &&
					!isInPeriod(at, SUMMARY_WINDOW_DAYS, now),
			);

			return {
				runningCourses: running.length,
				toGrade: tables.submissions.filter((row) => row.gradedAt === null)
					.length,
				classesToday: running
					.filter((course) => course.classDays.includes(weekday))
					.map((course) => ({
						courseId: course.id,
						code: course.code,
						title: course.title,
						classTime: course.classTime,
					})),
				paths: [...running]
					.sort((first, second) => first.startAt.localeCompare(second.startAt))
					.slice(0, PATH_COUNT)
					.map((course) => {
						const released = lessonsReleasedOf(course, now);
						let lessonsBefore = 0;
						// A module is open when its last lesson is open. The lessons open in module order.
						const modulesOpen = course.modules.filter((module) => {
							lessonsBefore += module.lessons;
							return lessonsBefore <= released;
						}).length;
						return {
							id: course.id,
							title: course.title,
							code: course.code,
							track: course.track,
							modulesOpen,
							moduleCount: course.modules.length,
						};
					}),
				leaders: [...pointsByStudent]
					.sort((first, second) => second[1] - first[1])
					.slice(0, LEADER_COUNT)
					.map(([id, points]) => ({ id, name: names.get(id) ?? "", points })),
				passRate: {
					current:
						current.graded === 0 ? null : current.passed / current.graded,
					previous:
						previous.graded === 0 ? null : previous.passed / previous.graded,
					graded: current.graded,
					passed: current.passed,
				},
				grading: {
					submitted: runningWork.length,
					graded: gradedWork.length,
					toGrade: runningWork.length - gradedWork.length,
					gradedOnTime: gradedWork.filter(
						(row) =>
							row.gradedAt !== null &&
							waitDaysOf(row.submittedAt, Date.parse(row.gradedAt)) <=
								GRADING_TARGET_DAYS,
					).length,
					overdue: runningWork.filter(
						(row) =>
							row.gradedAt === null &&
							waitBandOf(row.submittedAt, now) === "overdue",
					).length,
				},
				activity: {
					lessons: tables.lessonCompletions.filter((row) =>
						isInPeriod(row.completedAt, SUMMARY_WINDOW_DAYS, lastFullDay),
					).length,
					submissions: tables.submissions.filter((row) =>
						isInPeriod(row.submittedAt, SUMMARY_WINDOW_DAYS, lastFullDay),
					).length,
					enrollments: tables.enrollments.filter((row) =>
						isInPeriod(row.enrolledAt, SUMMARY_WINDOW_DAYS, lastFullDay),
					).length,
				},
			};
		},
	});
}

/** The lessons that students finished per day for the last `days` full days (to yesterday), with the same days one period earlier. */
export function lessonsTrendQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["dashboard", "lessons-trend", days],
		queryFn: async () => {
			const now = Date.now();
			return buildDailySeries(
				getSampleTables(now).lessonCompletions.map((row) => ({
					occurredAt: row.completedAt,
					value: 1,
				})),
				days,
				endOfYesterday(now),
			);
		},
	});
}
