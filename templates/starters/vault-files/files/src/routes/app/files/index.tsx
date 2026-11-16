// The file browser behind login. The /app layout checks the session first.
// The search params hold the open folder, the view, the type filter, and the sort. Thin: the page lives in the files feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	FilesPage,
	FilesPageError,
	FilesPageSkeleton,
	filesQueryOptions,
	filesSearchSchema,
} from "~/features/files";

/** /app/files: the folders and files of the team workspace. */
export const Route = createFileRoute("/app/files/")({
	validateSearch: filesSearchSchema,
	loader: ({ context }) => context.queryClient.query(filesQueryOptions()),
	pendingComponent: FilesPageSkeleton,
	errorComponent: FilesPageError,
	component: FilesRoute,
});

function FilesRoute() {
	const search = Route.useSearch();
	return <FilesPage search={search} />;
}
