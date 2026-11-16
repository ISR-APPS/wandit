// The item list behind login: the stock level tabs, the family filter, and the searchable table.
// The /app/items route renders it after its loader. The route also uses the skeleton and the error below.
// The tab and the family live in the URL (items-search.ts), so the home can link to a filtered list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	LoadError,
	moneyFormat,
	pluralForm,
	STOCK_CATEGORIES,
	STOCK_STATUSES,
	StockGauge,
	StockStatusBadge,
	unitWord,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { itemsQueryOptions, type StockItem } from "../api/items.queries";

/** The list page. The family filter applies first, then the level tab; DataTable then searches, sorts, and pages. */
export function ItemsPage() {
	const { t, locale } = useT();
	const { data: items } = useSuspenseQuery(itemsQueryOptions());
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

	const inCategory = search.category
		? items.filter((item) => item.category === search.category)
		: items;
	// A tab shows only for a level that has rows in the chosen family. The counts follow the family filter.
	const tabs = STOCK_STATUSES.map((status) => ({
		status,
		count: inCategory.filter((item) => item.status === status).length,
	})).filter((tab) => tab.count > 0);
	const activeStatus = tabs.some((tab) => tab.status === search.status)
		? search.status
		: undefined;
	const rows = activeStatus
		? inCategory.filter((item) => item.status === activeStatus)
		: inCategory;
	const totalValue = items.reduce((sum, item) => sum + item.stockValue, 0);

	// On hand comes second: a phone shows the first two columns before the table scrolls.
	// No minimum or family column: the gauge tick shows the minimum, and the SKU prefix and the filter show the family.
	const columns: DataTableColumn<StockItem>[] = [
		{
			id: "item",
			header: t("items.item"),
			sortValue: (item) => item.name,
			// justify-items-start: each line is as wide as its text, so dir="auto" text stays at the start side.
			// after:-inset-2 stretches the link over the cell padding, for a 44 px touch target.
			cell: (item) => (
				<div className="relative grid justify-items-start gap-0.5">
					<Link
						to="/app/items/$itemId"
						params={{ itemId: item.id }}
						className="font-medium after:absolute after:-inset-2 hover:underline"
						dir="auto"
					>
						{item.name}
					</Link>
					<span className="font-numeric text-muted-foreground text-xs">
						{`${item.sku} · ${item.bin}`}
					</span>
					{/* Under 32rem the Status column is past the scroll, and the gauge is hidden from screen readers. */}
					<span className="@lg/main:hidden pt-1">
						<StockStatusBadge status={item.status} />
					</span>
				</div>
			),
		},
		{
			id: "onHand",
			header: t("items.onHand"),
			align: "end",
			sortValue: (item) => item.onHand / Math.max(1, item.minimum),
			cell: (item) => (
				<div className="ms-auto grid w-28 justify-items-end gap-1.5">
					<span>
						<span className="font-medium">{number.format(item.onHand)}</span>{" "}
						<span className="text-muted-foreground text-xs">
							{unitWord(item.onHand, item.unit, t, locale)}
						</span>
					</span>
					<StockGauge
						onHand={item.onHand}
						minimum={item.minimum}
						reorderQuantity={item.reorderQuantity}
						status={item.status}
					/>
				</div>
			),
		},
		{
			id: "status",
			header: t("items.status"),
			sortValue: (item) => STOCK_STATUSES.indexOf(item.status),
			cell: (item) => <StockStatusBadge status={item.status} />,
		},
		{
			id: "onOrder",
			header: t("items.onOrder"),
			align: "end",
			sortValue: (item) => item.onOrder,
			cell: (item) =>
				item.onOrder > 0 ? (
					number.format(item.onOrder)
				) : (
					<span className="text-muted-foreground">{t("items.none")}</span>
				),
		},
		{
			id: "cover",
			header: t("items.cover"),
			align: "end",
			sortValue: (item) => item.daysOfCover ?? Number.POSITIVE_INFINITY,
			cell: (item) =>
				item.daysOfCover === null ? (
					<span className="text-muted-foreground">{t("items.none")}</span>
				) : (
					days.format(Math.floor(item.daysOfCover))
				),
		},
		{
			id: "value",
			header: t("items.value"),
			align: "end",
			sortValue: (item) => item.stockValue,
			cell: (item) => (
				<span title={money.format(item.unitCost)}>
					{wholeMoney.format(item.stockValue)}
				</span>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("items.title")}
				description={`${number.format(items.length)} ${t(`items.countLabel.${pluralForm(items.length, locale)}`)} · ${t("items.stockValue")} ${wholeMoney.format(totalValue)}`}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(item) =>
							`${item.name} ${item.sku} ${item.bin} ${item.supplierName}`
						}
						noResults={t("items.noResults")}
						toolbar={
							<>
								<Tabs
									value={activeStatus ?? "all"}
									onValueChange={(value) =>
										navigate({
											search: (previous) => ({
												...previous,
												status: STOCK_STATUSES.find(
													(status) => status === value,
												),
											}),
											replace: true,
										})
									}
									className="max-w-full overflow-x-auto"
								>
									<TabsList>
										<TabsTrigger value="all">
											{t("items.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(inCategory.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger key={tab.status} value={tab.status}>
												{t(`stockStatuses.${tab.status}`)}
												<span className="text-muted-foreground tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
								<Select
									value={search.category ?? "all"}
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
								>
									<SelectTrigger
										aria-label={t("items.category")}
										className="w-full sm:w-44"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											{t("items.allCategories")}
										</SelectItem>
										{STOCK_CATEGORIES.map((category) => (
											<SelectItem key={category} value={category}>
												{t(`categories.${category}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ItemsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-64" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<div className="flex flex-wrap gap-2">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						<Skeleton className="h-9 w-72" />
					</div>
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the item routes when a loader fails. */
export function ItemsPageError() {
	const { t } = useT();
	return <LoadError message={t("items.loadError")} />;
}
