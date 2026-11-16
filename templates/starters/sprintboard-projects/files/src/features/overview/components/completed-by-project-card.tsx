// The breakdown panel of the overview: the tasks done in the period per project, as one split bar and one row per project.
// OverviewPage renders it beside the figures. It follows the breakdown part of the chart form "compare".
import { Link } from "@tanstack/react-router";
import type { BreakdownSlice } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// The parts take the chart colors in order. A sixth part ("other") takes a light muted color.
// The full muted color is too close to chart-2 of most looks, so "other" reads as a seventh project.
const PART_COLORS = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
	"bg-chart-5",
	"bg-muted-foreground/35",
] as const;

type CompletedByProjectCardProps = {
	/** The 5 largest projects and "other", the largest first. The label of "other" is the code "other". */
	slices: BreakdownSlice[];
	/** The period text, for example "Last 30 days". */
	periodLabel: string;
};

/** A row of a project links to its page. The bar repeats the rows, so screen readers skip it. */
export function CompletedByProjectCard({
	slices,
	periodLabel,
}: CompletedByProjectCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.byProjectTitle")}</CardTitle>
				<CardDescription>{periodLabel}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				{total === 0 ? (
					<div className="grid gap-3">
						<div className="h-2.5 rounded-sm bg-muted" />
						<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
					</div>
				) : (
					<>
						<div
							aria-hidden="true"
							className="flex h-2.5 gap-0.5 overflow-hidden"
						>
							{slices.map((slice, index) => (
								<span
									key={slice.id}
									className={cn(
										"h-full rounded-sm",
										PART_COLORS[index] ?? "bg-muted-foreground",
									)}
									style={{ width: `${(slice.value / total) * 100}%` }}
								/>
							))}
						</div>
						<ul className="grid gap-0 divide-y">
							{slices.map((slice, index) => (
								<li
									key={slice.id}
									className="flex items-center gap-3 py-2.5 text-sm"
								>
									<span
										aria-hidden="true"
										className={cn(
											"size-2.5 shrink-0 rounded-sm",
											PART_COLORS[index] ?? "bg-muted-foreground",
										)}
									/>
									{slice.id === "other" ? (
										<span className="min-w-0 flex-1 truncate text-muted-foreground">
											{t("overview.otherProjects")}
										</span>
									) : (
										<Link
											to="/app/projects/$projectId"
											params={{ projectId: slice.id }}
											className="min-w-0 flex-1 truncate hover:underline"
										>
											{slice.label}
										</Link>
									)}
									<span className="font-medium tabular-nums">
										{number.format(slice.value)}
									</span>
									<span className="w-10 text-end text-muted-foreground tabular-nums">
										{share.format(slice.value / total)}
									</span>
								</li>
							))}
						</ul>
					</>
				)}
			</CardContent>
		</Card>
	);
}
