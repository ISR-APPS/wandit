// The retention card of the Reports page: the mean week 1 retention of the 4 newest complete cohorts,
// its change against the 4 cohorts before, and a line of each cohort. ReportsPage renders it third in the first row.
import { lazy, Suspense } from "react";
import { changeRatio } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { CohortRetention } from "../api/reports.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const RetentionLine = lazy(() =>
	import("./retention-line").then((module) => ({
		default: module.RetentionLine,
	})),
);

type RetentionCardProps = {
	/** The complete cohorts, the oldest first. */
	cohorts: CohortRetention[];
	/** The mean of the newest cohorts, and of the cohorts before them. */
	average: { current: number | null; previous: number | null };
};

/** A cohort with no new user has no rate: the mean skips it. */
export function RetentionCard({ cohorts, average }: RetentionCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const signedPercent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const change =
		average.current === null || average.previous === null
			? null
			: changeRatio(average.current, average.previous);
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("reports.retention.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="font-numeric font-semibold text-3xl tabular-nums leading-6">
					{average.current === null ? "–" : percent.format(average.current)}
				</p>
				<p className="mt-1.5 text-muted-foreground text-xs">
					{change === null ? (
						t("kpi.noComparison")
					) : (
						<>
							<bdi
								dir="ltr"
								className={cn(change < 0 ? "text-destructive" : "text-success")}
							>
								{signedPercent.format(change)}
							</bdi>{" "}
							{t("reports.retention.vsBefore")}
						</>
					)}
				</p>
				<Suspense fallback={<Skeleton className="mt-6 h-25" />}>
					<div className="mt-6">
						<RetentionLine cohorts={cohorts} />
					</div>
				</Suspense>
			</CardContent>
		</Card>
	);
}
