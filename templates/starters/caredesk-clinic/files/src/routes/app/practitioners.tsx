// The practitioners page behind login. The /app layout checks the session first.
// The loader fills the team cache. Thin: the page and its states live in the practitioners feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	PractitionersPage,
	PractitionersPageError,
	PractitionersPageSkeleton,
	practitionersQueryOptions,
} from "~/features/practitioners";

/** /app/practitioners: the team of the practice, its day, and its visits of the last 30 days. */
export const Route = createFileRoute("/app/practitioners")({
	loader: ({ context }) =>
		context.queryClient.query(practitionersQueryOptions()),
	pendingComponent: PractitionersPageSkeleton,
	errorComponent: PractitionersPageError,
	component: PractitionersPage,
});
