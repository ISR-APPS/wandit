// The content calendar behind login. The /app layout checks the session first.
// The loader fills the calendar cache. Thin: the page and its states live in the calendar feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	CalendarPage,
	CalendarPageError,
	CalendarPageSkeleton,
	calendarSearchSchema,
	contentItemsQueryOptions,
} from "~/features/calendar";

/** /app/calendar: posts, ads, emails, and videos. `?month=`, `?channel=`, and `?campaign=` set the view. */
export const Route = createFileRoute("/app/calendar")({
	validateSearch: calendarSearchSchema,
	loader: ({ context }) =>
		context.queryClient.query(contentItemsQueryOptions()),
	pendingComponent: CalendarPageSkeleton,
	errorComponent: CalendarPageError,
	component: CalendarPage,
});
