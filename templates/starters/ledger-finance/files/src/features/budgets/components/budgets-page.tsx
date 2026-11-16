// The budgets page behind login: the month tabs, the summary strip, the list of budgets, the spend curve,
// and the largest expenses. The /app/budgets route renders it after its loader.
// The route also uses the skeleton and the error below. The month lives in the URL.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	addMonths,
	type CategoryId,
	dayToDate,
	MoneyText,
	monthFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { budgetReportQueryOptions } from "../api/budgets.queries";
import type { BudgetMonth } from "../lib/budget-report";
import { BudgetLineSheet } from "./budget-line-sheet";
import { BudgetLinesCard } from "./budget-lines-card";
import { BudgetSummaryStrip } from "./budget-summary-strip";
import { BurnChartCard } from "./burn-chart-card";
import { LargestExpensesCard } from "./largest-expenses-card";

// The tabs in reading order: the older month first.
const MONTH_TABS = [
	"previous",
	"current",
] as const satisfies readonly BudgetMonth[];

type BudgetsPageProps = {
	/** The month from the URL: `?month=previous` gives "previous". */
	month: BudgetMonth;
	/** The category of the open side panel, from `?category=`. null shows no panel. */
	openCategory: CategoryId | null;
};

/** The page. A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function BudgetsPage({ month, openCategory }: BudgetsPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: report } = useSuspenseQuery(budgetReportQueryOptions(month));

	const monthName = monthFormat(locale);
	// The first day of each month choice, for the tab labels.
	const currentStart =
		month === "current" ? report.monthStart : addMonths(report.monthStart, 1);
	const monthStarts = {
		current: currentStart,
		previous: addMonths(currentStart, -1),
	} satisfies Record<BudgetMonth, string>;
	const monthShare =
		month === "current" ? report.elapsedDays / report.dayCount : null;
	const openLine =
		report.lines.find((line) => line.categoryId === openCategory) ?? null;
	// The sheet still shows the last budget while it slides out after a close.
	// A new open replaces it during render, so the state needs no effect.
	const [shownCategory, setShownCategory] = useState(openCategory);
	if (openLine !== null && openCategory !== shownCategory) {
		setShownCategory(openCategory);
	}
	const shownLine =
		report.lines.find((line) => line.categoryId === shownCategory) ?? null;

	// The panel lives in the URL, so a link can open one budget, and Back closes the panel.
	function showPanel(category: CategoryId | null) {
		void navigate({
			to: "/app/budgets",
			search: {
				month: month === "previous" ? "previous" : undefined,
				category: category ?? undefined,
			},
		});
	}

	return (
		<div className="grid grid-cols-1 gap-6">
			<PageHeader
				title={t("budgets.title")}
				description={t("budgets.description")}
				actions={
					<Tabs
						value={month}
						onValueChange={(value) => {
							void navigate({
								to: "/app/budgets",
								search: {
									month: value === "previous" ? "previous" : undefined,
								},
								replace: true,
							});
						}}
					>
						{/* On a phone the strip is 44 px high, the smallest comfortable touch area. */}
						<TabsList
							aria-label={t("budgets.month")}
							className="max-md:group-data-[orientation=horizontal]/tabs:h-11"
						>
							{MONTH_TABS.map((option) => (
								<TabsTrigger key={option} value={option} className="px-3">
									{monthName.format(dayToDate(monthStarts[option]))}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				}
			/>
			<BudgetSummaryStrip report={report} />
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid grid-cols-1 gap-6">
					<BudgetLinesCard
						lines={report.lines}
						monthShare={monthShare}
						onOpen={(line) => showPanel(line.categoryId)}
					/>
					{report.unbudgetedCents > 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("budgets.unbudgeted")}{" "}
							<MoneyText
								amountCents={report.unbudgetedCents}
								className="text-foreground"
							/>
						</p>
					) : null}
				</div>
				<div className="grid grid-cols-1 gap-6">
					<BurnChartCard points={report.burn} />
					<LargestExpensesCard rows={report.largest} />
				</div>
			</div>
			<BudgetLineSheet
				open={openLine !== null}
				line={shownLine}
				monthStart={report.monthStart}
				monthShare={monthShare}
				onClose={() => showPanel(null)}
			/>
		</div>
	);
}

// Placeholder cells and rows of the skeleton. Fixed keys, because they never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the budgets loader runs. The route sets it as pendingComponent. */
export function BudgetsPageSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-64 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<Skeleton className="h-28 w-full" />
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<Card className="@5xl/main:col-span-2">
					<div className="grid gap-4 px-6">
						{SKELETON_ROWS.map((key) => (
							<Skeleton key={key} className="h-14 w-full" />
						))}
					</div>
				</Card>
				<div className="grid gap-6">
					<Skeleton className="h-72" />
					<Skeleton className="h-64" />
				</div>
			</div>
		</div>
	);
}

/** Error state of the budgets page when the loader fails. Try again runs the loader again. */
export function BudgetsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("budgets.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
