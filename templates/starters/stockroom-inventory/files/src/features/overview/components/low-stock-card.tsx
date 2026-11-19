// The low stock card of the home: the items under their reorder point, the empty shelves first,
// with a filter field, sortable quantities, a row menu, and pages of 8. It takes the place of the kit "best sellers" card.
// OverviewPage renders it. "Export" downloads the rows as CSV, as a reorder list.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { itemCsvColumns, type StockItem } from "~/features/items";
import {
	copyToClipboard,
	downloadCsv,
	InitialsTile,
	toCsv,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

// Eight rows keep the card as high as the order card beside it, as in the kit.
const PAGE_SIZE = 8;

type LowStockCardProps = {
	/** The items that are low or out of stock, the most urgent first. */
	items: StockItem[];
	/** The grid span classes of the page. */
	className?: string;
};

/** An empty shelf shows its zero in the destructive color, so it reads first. */
export function LowStockCard({ items, className }: LowStockCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const columns: RecordColumn<StockItem>[] = [
		{
			id: "item",
			header: t("items.item"),
			sortValue: (item) => item.name,
			cell: (item) => (
				<span className="flex items-center gap-3">
					<InitialsTile name={item.name} className="size-8" />
					{/* Name only, as the kit row. A long name wraps to a second line, so the whole name stays readable. */}
					<Link
						to="/app/items/$itemId"
						params={{ itemId: item.id }}
						className="min-w-0 max-w-56 whitespace-normal font-medium hover:underline"
						dir="auto"
					>
						{item.name}
					</Link>
				</span>
			),
		},
		{
			id: "on-hand",
			header: t("items.onHand"),
			align: "end",
			sortValue: (item) => item.onHand,
			cell: (item) => (
				<span className={cn(item.onHand === 0 && "text-destructive")}>
					{number.format(item.onHand)}
				</span>
			),
		},
		{
			id: "minimum",
			header: t("items.minimum"),
			align: "end",
			sortValue: (item) => item.minimum,
			cell: (item) => number.format(item.minimum),
		},
	];

	return (
		<Card className={cn("min-w-0", className)}>
			<CardHeader>
				<CardTitle>{t("overview.lowStockTitle")}</CardTitle>
				<CardDescription>{t("overview.lowStockDescription")}</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={() =>
							downloadCsv(
								"reorder-list.csv",
								toCsv(items, itemCsvColumns(t, locale)),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={items}
					columns={columns}
					searchText={(item) => `${item.name} ${item.sku}`}
					searchPlaceholder={t("overview.filterItems")}
					rowMenu={(item) => (
						<>
							<DropdownMenuItem asChild>
								<Link to="/app/items/$itemId" params={{ itemId: item.id }}>
									{t("items.viewItem")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(item.sku, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("items.copySku")}
							</DropdownMenuItem>
						</>
					)}
					pageSize={PAGE_SIZE}
					noResults={t("overview.noLowStock")}
				/>
			</CardContent>
		</Card>
	);
}
