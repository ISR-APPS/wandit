// The menu behind login. The /app layout checks the session first.
// The loader fills the menu and the checks of the day, for the "sold today" column.
// Thin: the page and its states live in the menu feature.
import { createFileRoute } from "@tanstack/react-router";
import { MenuPage, MenuPageError, MenuPageSkeleton } from "~/features/menu";
import { menuQueryOptions, ordersQueryOptions } from "~/features/restaurant";

/** /app/menu: every dish and drink with its sales today. */
export const Route = createFileRoute("/app/menu")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(menuQueryOptions()),
			context.queryClient.query(ordersQueryOptions()),
		]),
	pendingComponent: MenuPageSkeleton,
	errorComponent: MenuPageError,
	component: MenuPage,
});
