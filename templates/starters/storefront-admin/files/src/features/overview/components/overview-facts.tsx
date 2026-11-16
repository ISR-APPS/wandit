// The facts row of the home: four figures in one ruled row with no panels, each with its change and a small spark.
// OverviewPage renders it under the hero with the same period. It reads the figures of that period itself.
// FactSpark draws each spark. It follows the facts slot of the home "hero" of the app-dashboard skill.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { ChangeLine, moneyFormat, type PeriodDays } from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { overviewKpisQueryOptions } from "../api/overview.queries";
import type { KpiItem } from "../lib/kpis";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const FactSpark = lazy(() =>
	import("./fact-spark").then((module) => ({ default: module.FactSpark })),
);

// Placeholder slots of the skeleton. Fixed keys, because the slots never reorder.
const SKELETON_FACTS = ["1", "2", "3", "4"];

/** Placeholder of the facts row: four slots in the final sizes. The page skeleton uses it too. */
export function OverviewFactsSkeleton() {
	return (
		<div className="grid @4xl/main:grid-cols-4 grid-cols-2 gap-6">
			{SKELETON_FACTS.map((key) => (
				<div key={key} className="grid gap-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-8 w-28" />
					<Skeleton className="h-10 w-full" />
				</div>
			))}
		</div>
	);
}

type OverviewFactsProps = {
	/** The period of the figures, in days. The hero header names it one time for the whole home. */
	days: PeriodDays;
};

/** One `dl` with one `div` for each fact. The wrapper clips the start rule of the first fact of each line. */
export function OverviewFacts({ days }: OverviewFactsProps) {
	const { t, locale } = useT();
	const kpis = useQuery({
		...overviewKpisQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	if (kpis.isError) {
		return (
			<div className="flex flex-wrap items-center gap-3">
				<p className="text-sm" role="alert">
					{t("overview.factsError")}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => kpis.refetch()}
				>
					{t("common.retry")}
				</Button>
			</div>
		);
	}
	if (kpis.data === undefined) {
		return <OverviewFactsSkeleton />;
	}

	const formats = {
		count: new Intl.NumberFormat(locale),
		money: moneyFormat(locale, "whole"),
		moneyCents: moneyFormat(locale),
	} satisfies Record<KpiItem["kind"], Intl.NumberFormat>;

	return (
		<div className="overflow-hidden">
			{/* The negative margin is the ps-6 padding plus the 1 px rule. It hides the rule of each line start. */}
			<dl className="-ms-[calc(var(--spacing)*6+1px)] flex flex-wrap gap-y-6">
				{kpis.data.map((item) => (
					<div
						key={item.id}
						className="grid @4xl/main:flex-1 basis-1/2 content-start gap-1 border-s ps-6 pe-6"
					>
						<dt className="label-text text-muted-foreground text-sm">
							{t(`overview.kpis.${item.id}`)}
						</dt>
						<dd className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
							<span className="font-numeric font-semibold text-2xl">
								{formats[item.kind].format(item.value)}
							</span>
							<ChangeLine change={item.change} goodWhen={item.goodWhen} />
						</dd>
						{/* The chart script loads after the page. The slot keeps the height of the spark. */}
						<dd className="mt-1 h-10">
							<Suspense fallback={<Skeleton className="h-10 w-full" />}>
								<FactSpark series={item.series} />
							</Suspense>
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}
