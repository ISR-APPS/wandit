// The figures of the home rail as a stacked list: one line per figure, label and change at the start, value at the end.
// OverviewPage renders it second in the rail. It takes the translated KpiItem rows of overviewKpisQueryOptions.
// The title names the period once, so no figure repeats it.
import { ChangeLine, type KpiItem } from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";

type FiguresCardProps = {
	/** The figures, the most important first, with their labels translated. */
	items: KpiItem[];
};

/** One row per figure, split by a rule. */
export function FiguresCard({ items }: FiguresCardProps) {
	const { t, locale } = useT();
	return (
		<Card className="gap-3 py-4">
			<CardHeader>
				<CardTitle>{t("overview.figuresTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid divide-y">
					{items.map((item) => (
						<div
							key={item.id}
							className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
						>
							{/* The change wraps under the label only when the rail is too narrow for one line. */}
							<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
								<dt className="label-text text-muted-foreground text-sm">
									{item.label}
								</dt>
								<ChangeLine item={item} />
							</div>
							<dd className="font-numeric font-semibold text-xl tabular-nums">
								{new Intl.NumberFormat(locale, item.format).format(item.value)}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3"];

/** Placeholder of the card: the three rows in their final sizes. */
export function FiguresCardSkeleton() {
	return (
		<Card className="gap-3 py-4">
			<CardHeader>
				<Skeleton className="h-5 w-28" />
			</CardHeader>
			<CardContent className="grid gap-4">
				{SKELETON_ROWS.map((key) => (
					<div key={key} className="flex items-start justify-between gap-3">
						<div className="grid gap-1.5">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-3 w-16" />
						</div>
						<Skeleton className="h-7 w-20" />
					</div>
				))}
			</CardContent>
		</Card>
	);
}
