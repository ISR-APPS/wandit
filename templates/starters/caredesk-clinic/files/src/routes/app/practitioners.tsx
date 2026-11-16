// The practitioners page behind login. The /app layout checks the session first.
// The loader fills the team cache and the visit breakdown. Thin: the page and its states live in the practitioners feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	PractitionersPage,
	PractitionersPageError,
	PractitionersPageSkeleton,
	practitionersQueryOptions,
	visitsByTypeQueryOptions,
} from "~/features/practitioners";

/** /app/practitioners: the team of the practice and its visits of the last 30 days. */
export const Route = createFileRoute("/app/practitioners")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(practitionersQueryOptions()),
			context.queryClient.query(visitsByTypeQueryOptions()),
		]),
	pendingComponent: PractitionersPageSkeleton,
	errorComponent: PractitionersPageError,
	component: PractitionersPage,
});
