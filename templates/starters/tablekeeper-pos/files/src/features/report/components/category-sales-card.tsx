// The "Sales by category" card of the day report, as the kit sales-by-location card.
// One row per menu category: the name, a badge with the portions, the share of the sales, and a bar.
// ReportPage renders it at the start of the third band. Export downloads the rows as CSV.
import { ExportIcon } from "@phosphor-icons/react";
import {
	downloadCsv,
	fillMessage,
	formatCents,
	moneyFormat,
	toCsv,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { CategoryRow } from "../lib/day-report";

type CategorySalesCardProps = {
	/** Every category in menu order. */
	categories: CategoryRow[];
	/** Sales of the day in cents. The rows add up to it, so each share is row / gross. */
	grossCents: number;
};

/** The bar of a row is its share of the gross sales, so the bars add up to 100 %. */
export function CategorySalesCard({
	categories,
	grossCents,
}: CategorySalesCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const shareOf = (row: CategoryRow) =>
		grossCents === 0 ? 0 : row.salesCents / grossCents;

	function exportCategories() {
		downloadCsv(
			"categories-today.csv",
			toCsv(
				categories.map((row) => ({ id: row.category, ...row })),
				[
					{
						header: t("report.category"),
						value: (row) => t(`menuCategories.${row.category}`),
					},
					{
						header: t("report.portions"),
						value: (row) => String(row.quantity),
					},
					// A plain number with a dot, so every spreadsheet reads it as a number. Cents become euros here.
					{
						header: t("report.sales"),
						value: (row) => (row.salesCents / 100).toFixed(2),
					},
				],
			),
		);
	}

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("report.salesByCategory")}</CardTitle>
				<CardDescription>
					{fillMessage(t("report.grossOfDay"), {
						amount: formatCents(money, grossCents),
					})}
				</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={exportCategories}
					>
						<ExportIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-5">
					{categories.map((row) => {
						const share = shareOf(row);
						return (
							<li key={row.category} className="grid gap-2">
								<div className="flex items-center justify-between gap-2">
									<span className="flex items-center gap-2">
										<span className="text-sm">
											{t(`menuCategories.${row.category}`)}
										</span>
										<Badge variant="outline">
											{fillMessage(t("report.portionsCount"), {
												count: number.format(row.quantity),
											})}
										</Badge>
									</span>
									<span className="text-sm tabular-nums">
										{percent.format(share)}
									</span>
								</div>
								<Progress
									value={Math.round(share * 100)}
									aria-label={t(`menuCategories.${row.category}`)}
								/>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
