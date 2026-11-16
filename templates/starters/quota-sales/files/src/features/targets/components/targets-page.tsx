// The targets page: the team attainment of a quarter, the territories against their targets, and the monthly plan.
// The /app/targets route renders it after its loader, which fills both quarters.
// The quarter tabs change the query key, so the page reads the chosen quarter with useQuery.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { fillMessage, PageError, PanelError } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	QUARTER_CHOICES,
	type QuarterChoice,
	type QuarterTargets,
	quarterTargetsQueryOptions,
} from "../api/targets.queries";
import { MonthlyPlanCard } from "./monthly-plan-card";
import { ShortfallCard } from "./shortfall-card";
import { TeamTargetCard } from "./team-target-card";
import { TerritoryTargetsCard } from "./territory-targets-card";

/** The page. The quarter tab sits in the header actions. */
export function TargetsPage() {
	const { t } = useT();
	const [choice, setChoice] = useState<QuarterChoice>("current");
	const query = useQuery({
		...quarterTargetsQueryOptions(choice),
		placeholderData: keepPreviousData,
	});

	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<PageHeader
				title={t("targets.title")}
				description={
					query.data ? (
						<QuarterLine targets={query.data} />
					) : (
						t("targets.description")
					)
				}
				actions={
					<Tabs
						value={choice}
						onValueChange={(value) =>
							setChoice(
								QUARTER_CHOICES.find((option) => option === value) ?? "current",
							)
						}
					>
						<TabsList aria-label={t("targets.quarter")}>
							<TabsTrigger value="current">{t("targets.current")}</TabsTrigger>
							<TabsTrigger value="previous">
								{t("targets.previous")}
							</TabsTrigger>
						</TabsList>
					</Tabs>
				}
			/>
			{query.isError ? (
				<Card>
					<PanelError
						message={t("targets.loadError")}
						onRetry={() => query.refetch()}
						className="h-64"
					/>
				</Card>
			) : query.data ? (
				<>
					<TeamTargetCard targets={query.data} />
					<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
						<div className="@4xl/main:col-span-2">
							<TerritoryTargetsCard
								territories={query.data.territories}
								pace={query.data.progress.pace}
							/>
						</div>
						<div className="grid content-start @3xl/main:gap-6 gap-4">
							<MonthlyPlanCard months={query.data.months} />
							<ShortfallCard
								shortfalls={query.data.shortfalls}
								isClosed={query.data.isClosed}
							/>
						</div>
					</div>
				</>
			) : (
				<TargetsBodySkeleton />
			)}
		</div>
	);
}

type QuarterLineProps = {
	targets: QuarterTargets;
};

// "Q4 2026, day 45 of 92" for the current quarter, "Q3 2026, closed" for a past one.
function QuarterLine({ targets }: QuarterLineProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return targets.isClosed
		? fillMessage(t("calendar.quarterClosed"), {
				quarter: targets.quarterLabel,
			})
		: fillMessage(t("calendar.quarterDay"), {
				quarter: targets.quarterLabel,
				day: number.format(targets.progress.elapsedDays + 1),
				total: number.format(targets.progress.totalDays),
			});
}

// The cards of the page while a quarter loads.
function TargetsBodySkeleton() {
	return (
		<>
			<Card>
				<CardHeader>
					<Skeleton className="h-5 w-40" />
				</CardHeader>
				<CardContent className="grid @4xl/main:grid-cols-[minmax(0,20rem)_1fr] gap-4">
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
				</CardContent>
			</Card>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<Skeleton className="@4xl/main:col-span-2 h-96" />
				<Skeleton className="h-96" />
			</div>
		</>
	);
}

/** Placeholder while the targets loader runs. The route sets it as pendingComponent. */
export function TargetsPageSkeleton() {
	return (
		<div className="flex flex-col @3xl/main:gap-6 gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-56" />
				</div>
				<Skeleton className="h-9 w-64" />
			</div>
			<TargetsBodySkeleton />
		</div>
	);
}

/** Error state of the page when a loader fails. The route sets it as errorComponent. */
export function TargetsPageError() {
	const { t } = useT();
	return <PageError message={t("targets.loadError")} />;
}
