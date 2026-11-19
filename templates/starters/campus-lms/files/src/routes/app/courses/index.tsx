// The Courses page behind login. The /app layout checks the session first.
// The loader fills the list cache, then the detail of the course that the page shows first.
// Thin: the page and its states live in the courses feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	CoursesPage,
	CoursesPageError,
	CoursesPageSkeleton,
	courseQueryOptions,
	coursesQueryOptions,
	featuredCourseId,
} from "~/features/courses";

/** /app/courses: the chosen course and the list of every course. */
export const Route = createFileRoute("/app/courses/")({
	loader: async ({ context }) => {
		const courses = await context.queryClient.query(coursesQueryOptions());
		const featuredId = featuredCourseId(courses);
		if (featuredId !== undefined) {
			await context.queryClient.query(courseQueryOptions(featuredId));
		}
	},
	pendingComponent: CoursesPageSkeleton,
	errorComponent: CoursesPageError,
	component: CoursesPage,
});
