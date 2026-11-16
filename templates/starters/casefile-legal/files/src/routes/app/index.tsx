// The home behind login: the board of matters. The /app layout checks the session first.
// The loader fills the matter list, the closed series, and the figures. Thin: the page lives in the board feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	BOARD_DAYS,
	BoardPage,
	BoardPageError,
	BoardPageSkeleton,
	boardFiguresQueryOptions,
	closedPerDayQueryOptions,
} from "~/features/board";
import { mattersQueryOptions } from "~/features/matters";

/** /app: the open matters by stage. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(mattersQueryOptions()),
			context.queryClient.query(closedPerDayQueryOptions(BOARD_DAYS)),
			context.queryClient.query(boardFiguresQueryOptions()),
		]),
	pendingComponent: BoardPageSkeleton,
	errorComponent: BoardPageError,
	component: BoardPage,
});
