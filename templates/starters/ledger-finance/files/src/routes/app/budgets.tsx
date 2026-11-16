// The budgets page behind login. The /app layout checks the session first.
// The loader fills the reports of both months, so a month change shows at once.
// Thin: the page and its states live in the budgets feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	BudgetsPage,
	BudgetsPageError,
	BudgetsPageSkeleton,
	budgetReportQueryOptions,
	budgetsSearchSchema,
} from "~/features/budgets";

/** /app/budgets. `?month=previous` shows the month before. `?category=software` opens the panel of one budget. */
export const Route = createFileRoute("/app/budgets")({
	validateSearch: budgetsSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(budgetReportQueryOptions("current")),
			context.queryClient.query(budgetReportQueryOptions("previous")),
		]),
	pendingComponent: BudgetsPageSkeleton,
	errorComponent: BudgetsPageError,
	component: BudgetsRoute,
});

function BudgetsRoute() {
	const { month, category } = Route.useSearch();
	return (
		<BudgetsPage month={month ?? "current"} openCategory={category ?? null} />
	);
}
