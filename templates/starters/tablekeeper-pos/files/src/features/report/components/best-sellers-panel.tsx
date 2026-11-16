// The "Best sellers" panel of the day report: the 6 dishes and drinks with the highest sales today.
// ReportPage renders it beside the categories. The menu page shows the same counts in its "Sold today" column.
// It reads the menu rows that buildMenuRows of ~/features/menu returns. It writes nothing.
import type { MenuRow } from "~/features/menu";
import { formatCents, moneyFormat } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

// 6 rows give the panel the height of the category list and its total beside it.
const BEST_SELLER_COUNT = 6;

type BestSellersPanelProps = {
	/** Every menu item with its sales of the day. The panel ranks them. */
	rows: MenuRow[];
};

/** A Card with a ranked table: the rank, the item, its category, the portions, and the sales. */
export function BestSellersPanel({ rows }: BestSellersPanelProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const ranked = rows
		.filter((row) => row.soldToday > 0)
		// A manager ranks by money: one lamb shoulder outweighs five espressos. Portions break a tie.
		.sort(
			(first, second) =>
				second.salesTodayCents - first.salesTodayCents ||
				second.soldToday - first.soldToday,
		)
		.slice(0, BEST_SELLER_COUNT);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("report.bestSellers")}</CardTitle>
			</CardHeader>
			<CardContent>
				{ranked.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("report.item")}</TableHead>
								<TableHead className="text-end">{t("report.sold")}</TableHead>
								<TableHead className="text-end">
									{t("report.revenue")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{ranked.map((row, index) => (
								<TableRow key={row.id}>
									<TableCell>
										<div className="flex items-center gap-3">
											<span className="w-4 text-muted-foreground text-xs tabular-nums">
												{number.format(index + 1)}
											</span>
											<span className="grid">
												<span className="font-medium">{row.name}</span>
												<span className="text-muted-foreground text-xs">
													{t(`menuCategories.${row.category}`)}
												</span>
											</span>
										</div>
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{number.format(row.soldToday)}
									</TableCell>
									<TableCell className="text-end font-medium tabular-nums">
										{formatCents(money, row.salesTodayCents)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
