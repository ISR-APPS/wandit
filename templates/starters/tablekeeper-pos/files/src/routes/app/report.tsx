// The day report behind login. The /app layout checks the session first.
// The loader fills the report, the menu, and the checks of the day, for the best sellers.
// Thin: the page and its states live in the report feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	dayReportQueryOptions,
	ReportPage,
	ReportPageError,
	ReportPageSkeleton,
} from "~/features/report";
import { menuQueryOptions, ordersQueryOptions } from "~/features/restaurant";

/** /app/report: the totals of the business day so far. */
export const Route = createFileRoute("/app/report")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(dayReportQueryOptions()),
			context.queryClient.query(menuQueryOptions()),
			context.queryClient.query(ordersQueryOptions()),
		]),
	pendingComponent: ReportPageSkeleton,
	errorComponent: ReportPageError,
	component: ReportPage,
});
