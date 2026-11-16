// The home behind login. The /app layout checks the session first.
// The loader fills the figures, the trend of the default period, the team breakdown, and the file list.
// Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import { filesQueryOptions } from "~/features/files";
import {
	DEFAULT_DAYS,
	dailyUploadsQueryOptions,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewKpisQueryOptions,
	uploadsByTeamQueryOptions,
} from "~/features/overview";

/** /app: the storage overview of the team workspace. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewKpisQueryOptions()),
			context.queryClient.query(dailyUploadsQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(uploadsByTeamQueryOptions(DEFAULT_DAYS)),
			context.queryClient.query(filesQueryOptions()),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
