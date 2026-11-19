// The sign-ups card of the Reports page: the new users of the last 8 weeks, the change against the 8 weeks before,
// and a bar per week with its count. ReportsPage renders it second in the first row.
import { lazy, Suspense } from "react";
import { changeRatio } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { WeekCount } from "../api/reports.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const SignUpBars = lazy(() =>
	import("./sign-up-bars").then((module) => ({ default: module.SignUpBars })),
);

type SignUpsCardProps = {
	/** The last 8 weeks, the oldest first. */
	weeks: WeekCount[];
	/** The sign-ups of those weeks, and of the 8 weeks before. */
	totals: { current: number; previous: number };
};

/** The value has a plus sign, as a count of new users. */
export function SignUpsCard({ weeks, totals }: SignUpsCardProps) {
	const { t, locale } = useT();
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const change = changeRatio(totals.current, totals.previous);
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("reports.signUps.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="font-numeric font-semibold text-3xl tabular-nums leading-6">
					{signed.format(totals.current)}
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
								{percent.format(change)}
							</bdi>{" "}
							{t("reports.signUps.vsBefore")}
						</>
					)}
				</p>
				<Suspense fallback={<Skeleton className="mt-6 h-25" />}>
					<div className="mt-6">
						<SignUpBars weeks={weeks} />
					</div>
				</Suspense>
			</CardContent>
		</Card>
	);
}
