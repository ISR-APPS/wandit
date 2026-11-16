// The matter list behind login. The /app layout checks the session first.
// The loader fills the list cache. Thin: the page and its states live in the matters feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	MattersPage,
	MattersPageError,
	MattersPageSkeleton,
	mattersQueryOptions,
	mattersSearchSchema,
} from "~/features/matters";

/** /app/matters: every matter of the firm. `?stage=` opens one stage tab, `?area=` filters one practice area. */
export const Route = createFileRoute("/app/matters/")({
	validateSearch: mattersSearchSchema,
	loader: ({ context }) => context.queryClient.query(mattersQueryOptions()),
	pendingComponent: MattersPageSkeleton,
	errorComponent: MattersPageError,
	component: MattersPage,
});
