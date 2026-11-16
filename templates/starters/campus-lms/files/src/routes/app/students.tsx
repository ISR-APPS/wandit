// The student list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the students feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	StudentsPage,
	StudentsPageError,
	StudentsPageSkeleton,
	studentsQueryOptions,
	studentsSearchSchema,
} from "~/features/students";

/** /app/students: every student of the school. `?student=` opens the side panel of one student. */
export const Route = createFileRoute("/app/students")({
	validateSearch: studentsSearchSchema,
	loader: ({ context }) => context.queryClient.query(studentsQueryOptions()),
	pendingComponent: StudentsPageSkeleton,
	errorComponent: StudentsPageError,
	component: StudentsPage,
});
