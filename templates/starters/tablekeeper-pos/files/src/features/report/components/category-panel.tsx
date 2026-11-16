// The "Sales by category" panel of the day report: one ranked bar per menu category.
// ReportPage renders it beside the best sellers. The bars rank the categories by their sales.
// It reads the category rows of the day report. It writes nothing.
import {
	fillMessage,
	formatCents,
	wholeMoneyFormat,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { CategoryRow } from "../lib/day-report";

type CategoryPanelProps = {
	/** Every category in menu order. The panel sorts them by sales. */
	rows: CategoryRow[];
};

/** Ranked rows, then the total. The track under each row shows its share of the largest category. */
export function CategoryPanel({ rows }: CategoryPanelProps) {
	const { t, locale } = useT();
	const money = wholeMoneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const ranked = [...rows].sort(
		(first, second) => second.salesCents - first.salesCents,
	);
	const largest = Math.max(0, ...ranked.map((row) => row.salesCents));
	const totalCents = rows.reduce((sum, row) => sum + row.salesCents, 0);
	const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("report.byCategory")}</CardTitle>
			</CardHeader>
			<CardContent className="flex-1">
				<ol className="grid gap-4">
					{ranked.map((row) => (
						<li key={row.category} className="grid gap-2 text-sm">
							<div className="flex items-baseline justify-between gap-3">
								<span className="min-w-0 truncate font-medium">
									{t(`menuCategories.${row.category}`)}
									<span className="ms-2 font-normal text-muted-foreground text-xs tabular-nums">
										{fillMessage(t("report.quantity"), {
											count: number.format(row.quantity),
										})}
									</span>
								</span>
								<span className="font-medium tabular-nums">
									{formatCents(money, row.salesCents)}
								</span>
							</div>
							<div className="h-1.5 overflow-hidden rounded-full bg-muted">
								{/* The width is the share of the largest category. It grows from the start side. */}
								<div
									className="h-full rounded-full bg-chart-1"
									style={{
										width: `${largest > 0 ? (row.salesCents / largest) * 100 : 0}%`,
									}}
								/>
							</div>
						</li>
					))}
				</ol>
			</CardContent>
			<CardFooter className="justify-between gap-4 border-t pt-4 text-sm">
				<span className="grid">
					<span className="font-medium">{t("report.grossSales")}</span>
					<span className="text-muted-foreground text-xs tabular-nums">
						{fillMessage(t("report.quantity"), {
							count: number.format(totalQuantity),
						})}
					</span>
				</span>
				<span className="font-numeric font-semibold text-lg tabular-nums">
					{formatCents(money, totalCents)}
				</span>
			</CardFooter>
		</Card>
	);
}
