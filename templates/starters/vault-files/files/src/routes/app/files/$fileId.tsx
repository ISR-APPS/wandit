// The page of one file. The /app layout checks the session first.
// The loader fills the file with its versions, shares, and history. Thin: the page lives in the files feature.
// A failed load shows the error state of the Files page: the same text and Try again.
import { createFileRoute } from "@tanstack/react-router";
import {
	FileDetailPage,
	FileDetailPageSkeleton,
	FilesPageError,
	fileQueryOptions,
} from "~/features/files";

/** /app/files/$fileId. `params.fileId` is any text from the URL; the query returns null for an unknown id. */
export const Route = createFileRoute("/app/files/$fileId")({
	loader: ({ context, params }) =>
		context.queryClient.query(fileQueryOptions(params.fileId)),
	pendingComponent: FileDetailPageSkeleton,
	errorComponent: FilesPageError,
	component: FileDetailRoute,
});

function FileDetailRoute() {
	const { fileId } = Route.useParams();
	return <FileDetailPage fileId={fileId} />;
}
