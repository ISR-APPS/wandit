// The classes page behind login. The /app layout checks the session first.
// The loader fills the timetable and the fill of each class. The search holds the day and the open session.
// Thin: the page and its states live in the classes feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	ClassesPage,
	ClassesPageError,
	ClassesPageSkeleton,
	classFillQueryOptions,
	classSessionsQueryOptions,
} from "~/features/classes";

// Every value comes from the URL. A wrong value gives the default state, not an error.
const classesSearchSchema = z.object({
	day: z.iso.date().optional().catch(undefined),
	session: z.string().max(40).optional().catch(undefined),
});

/** /app/classes. `?day=2026-11-16` picks a day, `&session=2026-11-16-1830` opens its roster. */
export const Route = createFileRoute("/app/classes")({
	validateSearch: classesSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(classSessionsQueryOptions()),
			context.queryClient.query(classFillQueryOptions()),
		]),
	pendingComponent: ClassesPageSkeleton,
	errorComponent: ClassesPageError,
	component: ClassesRoute,
});

function ClassesRoute() {
	const { day, session } = Route.useSearch();
	return <ClassesPage dayKey={day} sessionId={session} />;
}
