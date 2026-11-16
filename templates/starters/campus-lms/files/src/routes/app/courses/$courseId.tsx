// The page of one course. The /app layout checks the session first.
// The loader fills the course with its modules, students, and work. Thin: the page lives in the courses feature.
// A failed load shows the error state of the list page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	CourseDetailPage,
	CourseDetailPageSkeleton,
	CoursesPageError,
	courseQueryOptions,
} from "~/features/courses";

/** /app/courses/$courseId. `params.courseId` is any text from the URL; the query checks it. */
export const Route = createFileRoute("/app/courses/$courseId")({
	loader: ({ context, params }) =>
		context.queryClient.query(courseQueryOptions(params.courseId)),
	pendingComponent: CourseDetailPageSkeleton,
	errorComponent: CoursesPageError,
	component: CourseDetailRoute,
});

function CourseDetailRoute() {
	const { courseId } = Route.useParams();
	return <CourseDetailPage id={courseId} />;
}
