// The home behind login: the live floor. The /app layout checks the session first.
// The loader fills the floor board, the later bookings, the checks of the day, the 2 KPI figures,
// and the checks per day of the first period.
// Thin: the page and its states live in the floor feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	DEFAULT_DAYS,
	dailyChecksQueryOptions,
	FloorPage,
	FloorPageError,
	FloorPageSkeleton,
	floorKpisQueryOptions,
} from "~/features/floor";
import {
	floorQueryOptions,
	ordersQueryOptions,
	upcomingBookingsQueryOptions,
} from "~/features/restaurant";

// `table` is a table id from the URL, for example "t4". An id that is no table opens no panel.
const floorSearchSchema = z.object({
	table: z.string().max(10).optional().catch(undefined),
});

/** /app. `?table=t4` opens the side panel of table T4. */
export const Route = createFileRoute("/app/")({
	validateSearch: floorSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(floorQueryOptions()),
			context.queryClient.query(upcomingBookingsQueryOptions()),
			context.queryClient.query(ordersQueryOptions()),
			context.queryClient.query(floorKpisQueryOptions()),
			context.queryClient.query(dailyChecksQueryOptions(DEFAULT_DAYS)),
		]),
	pendingComponent: FloorPageSkeleton,
	errorComponent: FloorPageError,
	component: FloorRoute,
});

function FloorRoute() {
	const { table } = Route.useSearch();
	return <FloorPage openTableId={table} />;
}
