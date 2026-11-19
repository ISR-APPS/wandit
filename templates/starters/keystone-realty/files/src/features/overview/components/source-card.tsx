// The source card of the home: the new leads of one month per source, as a donut and a 2 x 2 legend.
// OverviewPage renders it in the middle of the third band, two columns wide. The donut file loads with React.lazy.
// The month select is state of the card: the three months come from one read of the home summary.
import { lazy, Suspense, useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { DonutSlice } from "~/shared/ui/donut-chart";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { SOURCE_PARTS, type SourceMonth } from "../lib/series";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const DonutChart = lazy(() =>
	import("~/shared/ui/donut-chart").then((module) => ({
		default: module.DonutChart,
	})),
);

type SourceCardProps = {
	/** This month and the two months before it, newest first. */
	months: SourceMonth[];
	className?: string;
};

/** The legend names each part and its count, so the color is never the only mark. */
export function SourceCard({ months, className }: SourceCardProps) {
	const { t, locale } = useT();
	const [monthKey, setMonthKey] = useState(months[0]?.month ?? "");
	const shown = months.find((month) => month.month === monthKey) ?? months[0];
	const number = new Intl.NumberFormat(locale);
	const monthName = new Intl.DateTimeFormat(locale, {
		month: "short",
		year: "numeric",
	});
	const slices: DonutSlice[] = SOURCE_PARTS.map((part, index) => ({
		key: part,
		label: t(`agency.leadSources.${part}`),
		value: shown?.counts[part] ?? 0,
		// The chart series 1 to 4 color the parts, in the order of SOURCE_PARTS.
		color: `var(--chart-${index + 1})`,
	}));
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);

	return (
		<Card className={cn("h-full", className)}>
			<CardHeader>
				<CardTitle>{t("overview.sources.title")}</CardTitle>
				<CardAction>
					<Select value={monthKey} onValueChange={setMonthKey}>
						<SelectTrigger
							aria-label={t("overview.sources.month")}
							className="w-auto"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{months.map((month) => (
								<SelectItem key={month.month} value={month.month}>
									{monthName.format(new Date(`${month.month}T12:00:00`))}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="@container/source">
				<div className="grid @sm/source:grid-cols-[11rem_1fr] items-center gap-6">
					<Suspense
						fallback={<Skeleton className="mx-auto size-44 rounded-full" />}
					>
						<DonutChart
							slices={slices}
							total={total}
							caption={t("overview.sources.caption")}
							title={t("overview.sources.title")}
						/>
					</Suspense>
					<ul className="grid grid-cols-2 gap-4">
						{slices.map((slice) => (
							<li key={slice.key} className="grid min-w-0 gap-1">
								<span className="flex items-center gap-2 text-muted-foreground text-sm">
									<span
										aria-hidden="true"
										className="size-2 shrink-0 rounded-full"
										style={{ backgroundColor: slice.color }}
									/>
									<span className="truncate">{slice.label}</span>
								</span>
								<span className="font-numeric font-semibold text-2xl tabular-nums">
									{number.format(slice.value)}
								</span>
							</li>
						))}
					</ul>
				</div>
			</CardContent>
		</Card>
	);
}
