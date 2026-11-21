// The classes page behind login: the week calendar of the timetable. The /app layout checks the session first.
// The loader fills the sessions of the week of the URL. The search holds the day and the open session.
// Thin: the page and its states live in the classes feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	ClassesPage,
	ClassesPageError,
	ClassesPageSkeleton,
	classWeekQueryOptions,
	weekKeyFor,
} from "~/features/classes";

// Every value comes from the URL. A wrong value gives the default state, not an error.
const classesSearchSchema = z.object({
	day: z.iso.date().optional().catch(undefined),
	session: z.string().max(40).optional().catch(undefined),
});

/** /app/classes. `?day=2026-11-16` picks its week, `&session=2026-11-16-1830` opens its roster. */
export const Route = createFileRoute("/app/classes")({
	validateSearch: classesSearchSchema,
	loaderDeps: ({ search }) => ({ day: search.day }),
	loader: ({ context, deps }) =>
		context.queryClient.query(
			classWeekQueryOptions(weekKeyFor(deps.day, Date.now())),
		),
	pendingComponent: ClassesPageSkeleton,
	errorComponent: ClassesPageError,
	component: ClassesRoute,
});

function ClassesRoute() {
	const { day, session } = Route.useSearch();
	return <ClassesPage dayKey={day} sessionId={session} />;
}
