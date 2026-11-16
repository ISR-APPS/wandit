// Reads of the home: the lessons per day, the most active courses, the enrollments per day, and the newest enrollments.
// The /app loader prefetches them for the default period. The sections read another period after a click.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase rpc that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	buildDailySeries,
	getSampleTables,
	isInPeriod,
} from "~/features/school";

/** One course in the "most active" list. The last line can be the rest of the courses. */
export type CourseActivity = {
	/** The id of the course, or null for the line that sums the other courses. */
	courseId: string | null;
	/** The title of the course. Empty for the "other" line: the page translates its label. */
	title: string;
	/** Count of lessons that students finished in the period. */
	lessons: number;
};

/** One new enrollment, for the list of the home. */
export type NewEnrollment = {
	id: string;
	studentId: string;
	studentName: string;
	courseId: string;
	courseTitle: string;
	enrolledAt: string;
};

// The ranked list keeps this many courses. The rest go into one "other" line.
const TOP_COURSES = 5;
// The list under the enrollment trend shows this many rows.
const NEWEST_ENROLLMENTS = 4;

/** The lessons that students finished per day for the last `days` days, with the same days one period earlier. */
export function dailyLessonsQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["overview", "daily-lessons", days],
		queryFn: async () => {
			const now = Date.now();
			return buildDailySeries(
				getSampleTables(now).lessonCompletions.map((row) => ({
					occurredAt: row.completedAt,
					value: 1,
				})),
				days,
				now,
			);
		},
	});
}

/** The 5 courses with the most finished lessons in the last `days` days, then one line for the rest. */
export function courseActivityQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["overview", "course-activity", days],
		queryFn: async (): Promise<CourseActivity[]> => {
			const now = Date.now();
			const tables = getSampleTables(now);
			const counts = new Map<string, number>();
			for (const row of tables.lessonCompletions) {
				if (isInPeriod(row.completedAt, days, now)) {
					counts.set(row.courseId, (counts.get(row.courseId) ?? 0) + 1);
				}
			}
			const ranked = tables.courses
				.flatMap((course) => {
					const lessons = counts.get(course.id) ?? 0;
					return lessons > 0
						? [{ courseId: course.id, title: course.title, lessons }]
						: [];
				})
				.sort((first, second) => second.lessons - first.lessons);
			const rest = ranked
				.slice(TOP_COURSES)
				.reduce((sum, course) => sum + course.lessons, 0);
			return [
				...ranked.slice(0, TOP_COURSES),
				...(rest > 0 ? [{ courseId: null, title: "", lessons: rest }] : []),
			];
		},
	});
}

/** The new enrollments per day for the last `days` days, with the same days one period earlier. */
export function dailyEnrollmentsQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["overview", "daily-enrollments", days],
		queryFn: async () => {
			const now = Date.now();
			return buildDailySeries(
				getSampleTables(now).enrollments.map((row) => ({
					occurredAt: row.enrolledAt,
					value: 1,
				})),
				days,
				now,
			);
		},
	});
}

/** The 4 newest enrollments, with the student and the course names. */
export function newestEnrollmentsQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "newest-enrollments"],
		queryFn: async (): Promise<NewEnrollment[]> => {
			const tables = getSampleTables(Date.now());
			const students = new Map(tables.students.map((row) => [row.id, row]));
			const courses = new Map(tables.courses.map((row) => [row.id, row]));
			return [...tables.enrollments]
				.sort((first, second) =>
					second.enrolledAt.localeCompare(first.enrolledAt),
				)
				.slice(0, NEWEST_ENROLLMENTS)
				.flatMap((row) => {
					const student = students.get(row.studentId);
					const course = courses.get(row.courseId);
					return student && course
						? [
								{
									id: row.id,
									studentId: student.id,
									studentName: student.name,
									courseId: course.id,
									courseTitle: course.title,
									enrolledAt: row.enrolledAt,
								},
							]
						: [];
				});
		},
	});
}
