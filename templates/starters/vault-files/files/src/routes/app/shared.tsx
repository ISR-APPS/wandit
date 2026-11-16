// The Shared page behind login. The /app layout checks the session first.
// The loader fills the shares of team files, with their state and audience. Thin: the page lives in the sharing feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	SharedPage,
	SharedPageError,
	SharedPageSkeleton,
	sharesQueryOptions,
} from "~/features/sharing";

/** /app/shared: the shares of team files, with their state and audience. */
export const Route = createFileRoute("/app/shared")({
	loader: ({ context }) => context.queryClient.query(sharesQueryOptions()),
	pendingComponent: SharedPageSkeleton,
	errorComponent: SharedPageError,
	component: SharedPage,
});
