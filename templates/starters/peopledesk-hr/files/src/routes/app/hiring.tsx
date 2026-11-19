// The hiring page behind login. The /app layout checks the session first.
// The loader fills the positions and the candidates. Thin: the page lives in the hiring feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	candidatesQueryOptions,
	HiringPage,
	HiringPageError,
	HiringPageSkeleton,
	hiringSearchSchema,
	positionsQueryOptions,
} from "~/features/hiring";

/** /app/hiring: the pipeline board. `?position=` filters by position, `?candidate=` opens a candidate. */
export const Route = createFileRoute("/app/hiring")({
	validateSearch: hiringSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(positionsQueryOptions()),
			context.queryClient.query(candidatesQueryOptions()),
		]),
	pendingComponent: HiringPageSkeleton,
	errorComponent: HiringPageError,
	component: HiringPage,
});
