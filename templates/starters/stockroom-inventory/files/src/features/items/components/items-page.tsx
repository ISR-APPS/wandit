// The item list behind login, in the anatomy of the kit product list: four figure cards,
// then a toolbar (search, Status and Family filters, a Supplier select, Columns) and a table with checkboxes and pages.
// The /app/items route renders it after its loader. The route also uses the skeleton and the error below.
// The filters live in the URL (items-search.ts), so the home and the supplier list can link to a filtered list.
import { DownloadSimpleIcon, HourglassIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	downloadCsv,
	formatQuantity,
	InitialsTile,
	LoadError,
	moneyFormat,
	STOCK_CATEGORIES,
	STOCK_STATUSES,
	StockStatusBadge,
	toCsv,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	itemsQueryOptions,
	itemsSummaryQueryOptions,
	type StockItem,
} from "../api/items.queries";
import { itemCsvColumns } from "../lib/item-csv";
import { FigureCard } from "./figure-card";

// The Select needs a value for "no supplier filter". No supplier id is this word.
const ALL_SUPPLIERS = "all";
// Ten rows per page, as the kit product list shows.
const PAGE_SIZE = 10;

/** The list page. The URL filters apply first; RecordTable then searches, sorts, selects, and pages. */
export function ItemsPage() {
	const { t, locale } = useT();
	const { data: items } = useSuspenseQuery(itemsQueryOptions());
	const { data: summary } = useSuspenseQuery(itemsSummaryQueryOptions());
	const search = useSearch({ from: "/app/items/" });
	const navigate = useNavigate({ from: "/app/items/" });
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const wholeMoney = moneyFormat(locale, true);
	const days = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "narrow",
		maximumFractionDigits: 0,
	});
	// One entry per supplier of the catalog, in the order of their first item.
	const suppliers = [
		...new Map(items.map((item) => [item.supplierId, item.supplierName])),
	].map(([id, name]) => ({ id, name }));
	const rows = items.filter(
		(item) =>
			(!search.status || item.status === search.status) &&
			(!search.category || item.category === search.category) &&
			(!search.supplier || item.supplierId === search.supplier),
	);

	function exportRows(fileName: string, selected: StockItem[]) {
		downloadCsv(fileName, toCsv(selected, itemCsvColumns(t, locale)));
	}

	const columns: RecordColumn<StockItem>[] = [
		{
			id: "item",
			header: t("items.item"),
			sortValue: (item) => item.name,
			cell: (item) => (
				<span className="flex items-center gap-4">
					<InitialsTile name={item.name} className="size-12" />
					<Link
						to="/app/items/$itemId"
						params={{ itemId: item.id }}
						className="font-medium hover:underline"
						dir="auto"
					>
						{item.name}
					</Link>
				</span>
			),
		},
		{
			id: "unit-cost",
			header: t("items.unitCost"),
			hideable: true,
			sortValue: (item) => item.unitCost,
			cell: (item) => (
				<span className="tabular-nums">{money.format(item.unitCost)}</span>
			),
		},
		{
			id: "category",
			header: t("items.category"),
			hideable: true,
			sortValue: (item) => t(`categories.${item.category}`),
			cell: (item) => t(`categories.${item.category}`),
		},
		{
			id: "on-hand",
			header: t("items.onHand"),
			hideable: true,
			sortValue: (item) => item.onHand,
			cell: (item) => (
				<span className="whitespace-nowrap tabular-nums">
					{formatQuantity(item.onHand, item.unit, t, locale)}
				</span>
			),
		},
		{
			id: "sku",
			header: t("items.sku"),
			hideable: true,
			cell: (item) => <span className="tabular-nums">{item.sku}</span>,
		},
		{
			id: "cover",
			header: t("items.cover"),
			hideable: true,
			// An item with no pick has endless cover: it sorts last.
			sortValue: (item) => item.daysOfCover ?? Number.MAX_SAFE_INTEGER,
			cell: (item) => (
				<span className="flex items-center gap-1 whitespace-nowrap tabular-nums">
					<HourglassIcon className="size-4 text-muted-foreground" />
					{item.daysOfCover === null
						? t("items.none")
						: days.format(item.daysOfCover)}
				</span>
			),
		},
		{
			id: "status",
			header: t("items.status"),
			sortValue: (item) => STOCK_STATUSES.indexOf(item.status),
			cell: (item) => <StockStatusBadge status={item.status} />,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("items.title")}
				actions={
					<Button type="button" onClick={() => exportRows("items.csv", rows)}>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				<FigureCard
					label={t("items.stockValue")}
					value={wholeMoney.format(summary.stockValue.value)}
					figure={summary.stockValue}
					// A rise can be a restock or slow stock, so the change has no color.
					goodWhen="neutral"
				/>
				<FigureCard
					label={t("items.unitsOnHand")}
					value={number.format(summary.unitsOnHand.value)}
					figure={summary.unitsOnHand}
					goodWhen="neutral"
				/>
				<FigureCard
					label={t("items.lowStock")}
					value={number.format(summary.lowStock.value)}
					figure={summary.lowStock}
					goodWhen="down"
				/>
				<FigureCard
					label={t("items.outOfStock")}
					value={number.format(summary.outOfStock.value)}
					figure={summary.outOfStock}
					goodWhen="down"
				/>
			</div>
			<div className="pt-4">
				<RecordTable
					rows={rows}
					columns={columns}
					searchText={(item) => `${item.name} ${item.sku} ${item.bin}`}
					searchPlaceholder={t("items.search")}
					toolbar={
						<>
							<RecordFilter
								label={t("items.status")}
								options={STOCK_STATUSES.map((status) => ({
									value: status,
									label: t(`stockStatuses.${status}`),
								}))}
								value={search.status ?? null}
								onValueChange={(value) =>
									navigate({
										search: (previous) => ({
											...previous,
											status: STOCK_STATUSES.find((status) => status === value),
										}),
										replace: true,
									})
								}
							/>
							<RecordFilter
								label={t("items.category")}
								options={STOCK_CATEGORIES.map((category) => ({
									value: category,
									label: t(`categories.${category}`),
								}))}
								value={search.category ?? null}
								onValueChange={(value) =>
									navigate({
										search: (previous) => ({
											...previous,
											category: STOCK_CATEGORIES.find(
												(category) => category === value,
											),
										}),
										replace: true,
									})
								}
							/>
							<Select
								value={search.supplier ?? ALL_SUPPLIERS}
								onValueChange={(value) =>
									navigate({
										search: (previous) => ({
											...previous,
											supplier: value === ALL_SUPPLIERS ? undefined : value,
										}),
										replace: true,
									})
								}
							>
								<SelectTrigger
									aria-label={t("items.supplier")}
									className="w-auto max-w-64"
								>
									<span className="text-muted-foreground">
										{t("items.supplierPrefix")}
									</span>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_SUPPLIERS}>
										{t("items.allSuppliers")}
									</SelectItem>
									{suppliers.map((supplier) => (
										<SelectItem key={supplier.id} value={supplier.id}>
											{supplier.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</>
					}
					rowMenu={(item) => (
						<>
							<DropdownMenuItem asChild>
								<Link to="/app/items/$itemId" params={{ itemId: item.id }}>
									{t("items.viewItem")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link
									to="/app/purchase-orders"
									search={{ supplier: item.supplierId }}
								>
									{t("items.viewSupplierOrders")}
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
					selectable
					bulkActions={(selected) => (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9"
							onClick={() => exportRows("items-selected.csv", selected)}
						>
							<DownloadSimpleIcon />
							{t("table.exportSelected")}
						</Button>
					)}
					pageSize={PAGE_SIZE}
					noResults={t("items.noResults")}
				/>
			</div>
		</div>
	);
}

// Placeholder keys of the figure row. Fixed keys, because the cards never reorder.
const SKELETON_FIGURES = ["1", "2", "3", "4"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function ItemsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_FIGURES.map((key) => (
					<Skeleton key={key} className="h-28" />
				))}
			</div>
			<Skeleton className="mt-4 h-9 w-full max-w-xl" />
			<Skeleton className="h-160" />
		</div>
	);
}

/** Error state when the loader fails. */
export function ItemsPageError() {
	const { t } = useT();
	return <LoadError message={t("items.loadError")} />;
}
