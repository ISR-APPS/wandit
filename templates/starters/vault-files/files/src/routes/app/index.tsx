// The home behind login. The /app layout checks the session first.
// The loader fills the type cards, the folders, the storage, the newest uploads, and the default transfer bars.
// Thin: the page and its states live in the overview feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	DEFAULT_TRANSFER_PERIOD,
	OverviewPage,
	OverviewPageError,
	OverviewPageSkeleton,
	overviewQueryOptions,
	transferQueryOptions,
} from "~/features/overview";

/** /app: the storage overview of the team workspace. */
export const Route = createFileRoute("/app/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(overviewQueryOptions()),
			context.queryClient.query(transferQueryOptions(DEFAULT_TRANSFER_PERIOD)),
		]),
	pendingComponent: OverviewPageSkeleton,
	errorComponent: OverviewPageError,
	component: OverviewPage,
});
