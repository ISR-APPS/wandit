// The breakdown of the home: uploads per team of the uploader in the default period, with a share bar per team.
// OverviewPage renders it with the translated slices of uploadsByTeamQueryOptions(DEFAULT_DAYS).
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import type { BreakdownSlice } from "../lib/series";

type TeamUploadsCardProps = {
	/** The title names the period, because the period control changes only the trend. */
	title: string;
	/** Translated team names, the largest first. */
	slices: BreakdownSlice[];
};

/** One row per team: the name, the count, the share of all uploads, and a thin bar. */
export function TeamUploadsCard({ title, slices }: TeamUploadsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			{/* The trend card sets the row height. The rows spread over it, so no empty band sits above the total. */}
			<CardContent className="flex flex-1 flex-col">
				{total === 0 ? (
					<p className="m-auto text-center text-muted-foreground text-sm">
						{t("chart.breakdownEmpty")}
					</p>
				) : (
					<ul className="flex flex-1 flex-col justify-between gap-4">
						{slices.map((slice) => (
							<li key={slice.label} className="grid gap-1.5 text-sm">
								<div className="flex items-baseline justify-between gap-3">
									<span className="truncate">{slice.label}</span>
									<span className="shrink-0 tabular-nums">
										<span className="font-medium">
											{number.format(slice.value)}
										</span>
										<span className="ms-2 text-muted-foreground">
											<bdi dir="ltr">{percent.format(slice.value / total)}</bdi>
										</span>
									</span>
								</div>
								<Progress
									value={slice.value}
									max={total}
									aria-label={slice.label}
									className="h-1.5"
								/>
							</li>
						))}
						<li className="flex items-baseline justify-between gap-3 border-t pt-3 text-sm">
							<span className="text-muted-foreground">
								{t("chart.breakdownTotal")}
							</span>
							<span className="font-medium tabular-nums">
								{number.format(total)}
							</span>
						</li>
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

// Placeholder rows. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5"];

/** Placeholder of the breakdown panel in its final shape. */
export function TeamUploadsCardSkeleton() {
	return (
		<Card className="h-full">
			<CardHeader>
				<Skeleton className="h-5 w-44" />
			</CardHeader>
			<CardContent className="grid gap-4">
				{SKELETON_ROWS.map((key) => (
					<div key={key} className="grid gap-1.5">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-1.5 w-full" />
					</div>
				))}
			</CardContent>
		</Card>
	);
}
