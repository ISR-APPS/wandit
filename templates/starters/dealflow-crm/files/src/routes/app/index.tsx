// The home behind login: the pipeline board. The /app layout checks the session first.
// The loader fills the deal list and the won series. Thin: the page and its states live in the pipeline feature.
import { createFileRoute } from "@tanstack/react-router";
import { dealsQueryOptions, wonPerDayQueryOptions } from "~/features/deals";
import {
	BOARD_DAYS,
	PipelinePage,
	PipelinePageError,
	PipelinePageSkeleton,
} from "~/features/pipeline";

/** /app: the board of the open deals by stage. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(dealsQueryOptions()),
			context.queryClient.query(wonPerDayQueryOptions(BOARD_DAYS)),
		]),
	pendingComponent: PipelinePageSkeleton,
	errorComponent: PipelinePageError,
	component: PipelinePage,
});
