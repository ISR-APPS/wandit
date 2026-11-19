// The "Best sellers" card of the day report, as the kit best-selling-products card: Export, a filter field, and a table.
// Columns: dish, portions sold (sortable), sales (sortable), and a row menu. 8 rows per page.
// The card has no dish image: the 5/12 column is too narrow for an image and the row menu.
// ReportPage renders it at the end of the last band. It reads the menu rows of ~/features/menu.
import { ExportIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { MenuRow } from "~/features/menu";
import {
	copyToClipboard,
	downloadCsv,
	formatCents,
	moneyFormat,
	toCsv,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

// 8 rows per page, as the kit best-selling card.
const PAGE_SIZE = 8;

type DishSalesCardProps = {
	/** The dishes sold today, the highest sales first. */
	dishes: MenuRow[];
};

/** The row menu opens the menu page or copies the dish name. */
export function DishSalesCard({ dishes }: DishSalesCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);

	const columns: RecordColumn<MenuRow>[] = [
		{
			id: "dish",
			header: t("menu.dish"),
			cell: (row) => <span dir="auto">{row.name}</span>,
		},
		{
			id: "sold",
			header: t("menu.soldToday"),
			cell: (row) => (
				<span className="tabular-nums">{number.format(row.soldToday)}</span>
			),
			sortValue: (row) => row.soldToday,
			hideable: true,
		},
		{
			id: "sales",
			header: t("menu.sales"),
			cell: (row) => (
				<span className="tabular-nums">
					{formatCents(money, row.salesTodayCents)}
				</span>
			),
			sortValue: (row) => row.salesTodayCents,
			hideable: true,
		},
	];

	function exportDishes() {
		downloadCsv(
			"best-sellers-today.csv",
			toCsv(dishes, [
				{ header: t("menu.dish"), value: (row) => row.name },
				{ header: t("menu.soldToday"), value: (row) => String(row.soldToday) },
				// A plain number with a dot, so every spreadsheet reads it as a number. Cents become euros here.
				{
					header: t("menu.sales"),
					value: (row) => (row.salesTodayCents / 100).toFixed(2),
				},
			]),
		);
	}

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("report.bestSellers")}</CardTitle>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={exportDishes}
					>
						<ExportIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={dishes}
					columns={columns}
					searchText={(row) => row.name}
					searchPlaceholder={t("report.filterDishes")}
					rowMenu={(row) => (
						<>
							<DropdownMenuItem asChild>
								<Link to="/app/menu">{t("report.openMenu")}</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(row.name, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("menu.copyName")}
							</DropdownMenuItem>
						</>
					)}
					pageSize={PAGE_SIZE}
					noResults={t("report.noDishes")}
				/>
			</CardContent>
		</Card>
	);
}
