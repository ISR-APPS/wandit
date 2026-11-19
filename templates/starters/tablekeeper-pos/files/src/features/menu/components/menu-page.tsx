// The menu behind login, in the anatomy of the kit product list.
// The header with "New order", 4 figure cards with a badge, then RecordTable with a search, 3 filter buttons,
// a column menu, row checkboxes, and a row menu. A dish name or "View details" opens MenuItemDialog.
// The /app/menu route renders it after its loader. The route also uses the skeleton and the error below.
import { PlusIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	changeFormat,
	changeRatio,
	copyToClipboard,
	countLabel,
	dayTotalsQueryOptions,
	downloadCsv,
	fillMessage,
	formatCents,
	isGoodChange,
	MENU_CATEGORIES,
	MENU_CATEGORY_ICON,
	menuQueryOptions,
	moneyFormat,
	ordersQueryOptions,
	toCsv,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { buildMenuRows, type MenuRow } from "../lib/menu-sales";
import { MenuItemDialog } from "./menu-item-dialog";

// 10 rows per page, as the kit product list.
const PAGE_SIZE = 10;

/** The value of the status filter. Its label is the message key `menu.<status>`. */
type ItemStatus = "available" | "soldOut";

/** One figure card. `badge` is the small text at the end of the head. */
type MenuFigure = {
	id: string;
	label: string;
	value: string;
	badge: string | null;
	/** "success" and "destructive" for a delta, "outline" for a plain context. */
	badgeVariant: "success" | "destructive" | "outline";
};

/** The filters cut the rows; then RecordTable searches, sorts, selects, and pages them. */
export function MenuPage() {
	const { t, locale } = useT();
	const { data: items } = useSuspenseQuery(menuQueryOptions());
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const { data: totals } = useSuspenseQuery(dayTotalsQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [category, setCategory] = useState<string | null>(null);
	const [station, setStation] = useState<string | null>(null);
	const [openItemId, setOpenItemId] = useState<string | null>(null);
	// The dialog keeps the last item while it closes, so its content does not vanish mid-animation.
	const [shownItemId, setShownItemId] = useState<string | null>(null);

	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const menuRows = buildMenuRows(items, orders);
	const statusOf = (row: MenuRow): ItemStatus =>
		row.isAvailable ? "available" : "soldOut";
	const rows = menuRows.filter(
		(row) =>
			(status === null || statusOf(row) === status) &&
			(category === null || row.category === category) &&
			(station === null || row.station === station),
	);
	const shownRow = menuRows.find((row) => row.id === shownItemId);
	const categorySalesCents = shownRow
		? menuRows
				.filter((row) => row.category === shownRow.category)
				.reduce((sum, row) => sum + row.salesTodayCents, 0)
		: 0;

	const salesCents = menuRows.reduce(
		(sum, row) => sum + row.salesTodayCents,
		0,
	);
	const portions = menuRows.reduce((sum, row) => sum + row.soldToday, 0);
	const soldOut = menuRows.filter((row) => !row.isAvailable).length;
	const salesChange = totals.lastWeek
		? changeRatio(totals.today.salesCents, totals.lastWeek.salesCents)
		: null;
	const figures: MenuFigure[] = [
		{
			id: "sales",
			label: t("menu.salesToday"),
			value: formatCents(money, salesCents),
			badge:
				salesChange === null ? null : changeFormat(locale).format(salesChange),
			badgeVariant:
				salesChange === null || isGoodChange(salesChange, "up")
					? "success"
					: "destructive",
		},
		{
			id: "portions",
			label: t("menu.portionsSold"),
			value: number.format(portions),
			badge:
				totals.today.checks === 0
					? null
					: fillMessage(t("menu.perCheck"), {
							count: new Intl.NumberFormat(locale, {
								maximumFractionDigits: 1,
							}).format(portions / totals.today.checks),
						}),
			badgeVariant: "outline",
		},
		{
			id: "average",
			label: t("menu.averagePrice"),
			value: formatCents(
				money,
				portions === 0 ? 0 : Math.round(salesCents / portions),
			),
			badge: countLabel(
				menuRows.length,
				t("counts.dishes.one"),
				t("counts.dishes.other"),
				locale,
			),
			badgeVariant: "outline",
		},
		{
			id: "soldOut",
			label: t("menu.soldOut"),
			value: number.format(soldOut),
			badge: fillMessage(t("menu.ofDishes"), {
				count: number.format(menuRows.length),
			}),
			badgeVariant: soldOut > 0 ? "destructive" : "outline",
		},
	];

	function openItem(id: string) {
		setShownItemId(id);
		setOpenItemId(id);
	}

	const columns: RecordColumn<MenuRow>[] = [
		{
			id: "dish",
			header: t("menu.dish"),
			cell: (row) => {
				const CategoryIcon = MENU_CATEGORY_ICON[row.category];
				return (
					<button
						type="button"
						onClick={() => openItem(row.id)}
						className="flex items-center gap-4 text-start hover:underline"
					>
						{/* The app has no food photos: the category icon stands in for the kit product image. */}
						<span
							aria-hidden="true"
							className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
						>
							<CategoryIcon className="size-5" />
						</span>
						<span dir="auto">{row.name}</span>
					</button>
				);
			},
			sortValue: (row) => row.name,
		},
		{
			id: "price",
			header: t("menu.price"),
			cell: (row) => formatCents(money, row.priceCents),
			sortValue: (row) => row.priceCents,
			hideable: true,
		},
		{
			id: "category",
			header: t("menu.category"),
			cell: (row) => t(`menuCategories.${row.category}`),
			sortValue: (row) => MENU_CATEGORIES.indexOf(row.category),
			hideable: true,
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
			id: "station",
			header: t("menu.station"),
			cell: (row) => t(`stations.${row.station}`),
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
			hideable: true,
		},
		{
			id: "status",
			header: t("menu.status"),
			cell: (row) => (
				<Badge variant={row.isAvailable ? "success" : "destructive"}>
					{t(row.isAvailable ? "menu.available" : "menu.soldOut")}
				</Badge>
			),
			sortValue: (row) => (row.isAvailable ? 0 : 1),
			hideable: true,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("menu.title")}
				description={fillMessage(t("menu.description"), {
					items: countLabel(
						menuRows.length,
						t("counts.items.one"),
						t("counts.items.other"),
						locale,
					),
					soldOut: number.format(soldOut),
				})}
				actions={
					<Button asChild>
						<Link to="/app/order">
							<PlusIcon />
							{t("menu.newOrder")}
						</Link>
					</Button>
				}
			/>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{figures.map((figure) => (
					<Card key={figure.id}>
						<CardHeader>
							<CardDescription>{figure.label}</CardDescription>
							<CardTitle className="font-normal font-numeric @4xl/main:text-3xl text-2xl tabular-nums">
								{figure.value}
							</CardTitle>
							{figure.badge ? (
								<CardAction>
									<Badge variant={figure.badgeVariant}>
										{/* dir="ltr" keeps "+3.6%" in this order in an Arabic page. */}
										<bdi dir="ltr">{figure.badge}</bdi>
									</Badge>
								</CardAction>
							) : null}
						</CardHeader>
					</Card>
				))}
			</div>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) => row.name}
				searchPlaceholder={t("menu.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("menu.status")}
							options={(["available", "soldOut"] as const).map((value) => ({
								value,
								label: t(`menu.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("menu.category")}
							options={MENU_CATEGORIES.map((value) => ({
								value,
								label: t(`menuCategories.${value}`),
							}))}
							value={category}
							onValueChange={setCategory}
						/>
						<RecordFilter
							label={t("menu.station")}
							options={(["kitchen", "bar"] as const).map((value) => ({
								value,
								label: t(`stations.${value}`),
							}))}
							value={station}
							onValueChange={setStation}
						/>
					</>
				}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"menu-selected.csv",
								toCsv(selected, [
									{ header: t("menu.dish"), value: (row) => row.name },
									{
										header: t("menu.category"),
										value: (row) => t(`menuCategories.${row.category}`),
									},
									// A plain number with a dot, so every spreadsheet reads it as a number. Cents become euros here.
									{
										header: t("menu.price"),
										value: (row) => (row.priceCents / 100).toFixed(2),
									},
									{
										header: t("menu.soldToday"),
										value: (row) => String(row.soldToday),
									},
								]),
							)
						}
					>
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem onSelect={() => openItem(row.id)}>
							{t("menu.viewDetails")}
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
				noResults={
					menuRows.length === 0 ? t("menu.empty") : t("menu.noResults")
				}
			/>
			<MenuItemDialog
				row={shownRow}
				categorySalesCents={categorySalesCents}
				open={openItemId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setOpenItemId(null);
					}
				}}
			/>
		</div>
	);
}

// Placeholder cards and rows of the skeleton. Fixed keys, because they never reorder.
const SKELETON_FIGURES = ["1", "2", "3", "4"];

/** Placeholder while the menu loader runs. The route sets it as pendingComponent. */
export function MenuPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-32" />
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_FIGURES.map((key) => (
					<Skeleton key={key} className="h-28 rounded-surface" />
				))}
			</div>
			<Skeleton className="h-9 w-full max-w-xl" />
			<Skeleton className="h-96 w-full" />
		</div>
	);
}

/** Error state of the menu when the loader fails. Try again runs the loader again. */
export function MenuPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("menu.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
