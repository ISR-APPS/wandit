// The figures of the home rail: one line per KPI, the label at the start and the value at the end.
// OverviewPage renders it with the first KPI rows of overviewKpisQueryOptions(). The title names the period once.
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { KpiItem } from "../lib/series";
import { ChangeLine } from "./change-line";

type FiguresCardProps = {
	/** The figures to show, the most important first. The labels are translated. */
	items: KpiItem[];
	/** Grid placement classes from the home layout, for example a column span. */
	className?: string;
};

// In the rail: one line per figure. From 42rem to 56rem the card spans the home width, so the figures sit in a row.
// In a row, a label can wrap. The labels then align at the top, and the changes and the values at the bottom.
const FIGURE_LIST =
	"grid divide-y @2xl/main:grid-cols-3 @4xl/main:grid-cols-1 @2xl/main:divide-x @4xl/main:divide-x-0 @2xl/main:divide-y-0 @4xl/main:divide-y";
const FIGURE_LINE =
	"flex justify-between gap-3 py-2 first:pt-0 last:pb-0 @2xl/main:px-5 @4xl/main:px-0 @2xl/main:py-0 @4xl/main:py-2 @2xl/main:first:ps-0 @2xl/main:last:pe-0 @4xl/main:first:pt-0 @4xl/main:last:pb-0";

/** The number form of a KPI as a stacked list. Each figure compares with the 30 days before. */
export function FiguresCard({ items, className }: FiguresCardProps) {
	const { t, locale } = useT();
	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("overview.figuresTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className={FIGURE_LIST}>
					{items.map((item) => (
						<div key={item.id} className={FIGURE_LINE}>
							<div className="grid grid-rows-[1fr_auto] gap-1">
								<dt className="label-text text-sm">{item.label}</dt>
								<ChangeLine change={item.change} goodWhen={item.goodWhen} />
							</div>
							<dd className="self-end whitespace-nowrap font-numeric text-3xl tabular-nums leading-none">
								{new Intl.NumberFormat(locale, item.format).format(item.value)}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}

type FiguresCardSkeletonProps = {
	/** Count of figure lines, the same as the loaded card. */
	count: number;
};

/** Placeholder of the figures card, with the lines in their final size. */
export function FiguresCardSkeleton({ count }: FiguresCardSkeletonProps) {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-4 w-28" />
			</CardHeader>
			<CardContent className="grid gap-5">
				{Array.from({ length: count }, (_, index) => `figure-${index}`).map(
					(key) => (
						<div key={key} className="flex items-end justify-between gap-3">
							<div className="grid gap-2">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-4 w-16" />
							</div>
							<Skeleton className="h-8 w-14" />
						</div>
					),
				)}
			</CardContent>
		</Card>
	);
}
