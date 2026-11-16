// The Trash page behind login. The /app layout checks the session first.
// The loader fills the deleted files until their final delete. Thin: the page lives in the trash feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	TrashPage,
	TrashPageError,
	TrashPageSkeleton,
	trashQueryOptions,
} from "~/features/trash";

/** /app/trash: the deleted files until their final delete. */
export const Route = createFileRoute("/app/trash")({
	loader: ({ context }) => context.queryClient.query(trashQueryOptions()),
	pendingComponent: TrashPageSkeleton,
	errorComponent: TrashPageError,
	component: TrashPage,
});
