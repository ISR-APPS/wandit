// The hiring page behind login. The /app layout checks the session first.
// The loader fills the positions, the candidates, and the figures. Thin: the page lives in the hiring feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	candidatesQueryOptions,
	HiringPage,
	HiringPageError,
	HiringPageSkeleton,
	hiringKpisQueryOptions,
	hiringSearchSchema,
	positionsQueryOptions,
} from "~/features/hiring";

/** /app/hiring: the positions and the pipeline. `?position=` picks a position, `?candidate=` opens a candidate. */
export const Route = createFileRoute("/app/hiring")({
	validateSearch: hiringSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(positionsQueryOptions()),
			context.queryClient.query(candidatesQueryOptions()),
			context.queryClient.query(hiringKpisQueryOptions()),
		]),
	pendingComponent: HiringPageSkeleton,
	errorComponent: HiringPageError,
	component: HiringPage,
});
