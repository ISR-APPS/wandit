// The home behind login: the room board. The /app layout checks the session first.
// The loader fills the board, the KPI figures, the check-ins of the first period, and the channel breakdown.
// Thin: the page and its states live in the front-desk feature.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	checkInsByChannelQueryOptions,
	DEFAULT_DAYS,
	dailyCheckInsQueryOptions,
	FrontDeskPage,
	FrontDeskPageError,
	FrontDeskPageSkeleton,
	frontDeskKpisQueryOptions,
	roomBoardQueryOptions,
} from "~/features/front-desk";

// `room` is a door number from the URL, for example 204. The router reads it as a number.
// A value that is no room opens no panel.
const frontDeskSearchSchema = z.object({
	room: z.number().int().positive().optional().catch(undefined),
});

/** /app. `?room=204` opens the side panel of room 204. */
export const Route = createFileRoute("/app/")({
	validateSearch: frontDeskSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(roomBoardQueryOptions()),
			context.queryClient.query(frontDeskKpisQueryOptions()),
			context.queryClient.query(dailyCheckInsQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(checkInsByChannelQueryOptions()),
		]),
	pendingComponent: FrontDeskPageSkeleton,
	errorComponent: FrontDeskPageError,
	component: FrontDeskRoute,
});

function FrontDeskRoute() {
	const { room } = Route.useSearch();
	return (
		<FrontDeskPage
			openRoomNumber={room === undefined ? undefined : String(room)}
		/>
	);
}
