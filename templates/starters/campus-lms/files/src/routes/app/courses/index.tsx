// The course list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the courses feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	CoursesPage,
	CoursesPageError,
	CoursesPageSkeleton,
	coursesQueryOptions,
} from "~/features/courses";

/** /app/courses: every course of the school as a card. */
export const Route = createFileRoute("/app/courses/")({
	loader: ({ context }) => context.queryClient.query(coursesQueryOptions()),
	pendingComponent: CoursesPageSkeleton,
	errorComponent: CoursesPageError,
	component: CoursesPage,
});
