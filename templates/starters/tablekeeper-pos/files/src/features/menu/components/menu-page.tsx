// The menu behind login: every dish and drink with its price, its sales today, and its availability.
// The /app/menu route renders it after its loader. Category tabs and the search filter the table.
// A dish name opens MenuItemDialog. The route also uses the skeleton and the error below.
// On a phone the tabs wrap, and the price cell also shows the sales today, because the table cuts the later columns.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	fillMessage,
	formatCents,
	MENU_CATEGORIES,
	type MenuCategory,
	menuQueryOptions,
	moneyFormat,
	ordersQueryOptions,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { buildMenuRows, type MenuRow } from "../lib/menu-sales";
import { MenuItemDialog } from "./menu-item-dialog";

/** The list page. The category tab filters the rows; then DataTable searches, sorts, and pages them. */
export function MenuPage() {
	const { t, locale } = useT();
	const { data: items } = useSuspenseQuery(menuQueryOptions());
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const [category, setCategory] = useState<MenuCategory | "all">("all");
	const [openItemId, setOpenItemId] = useState<string | null>(null);
	// The dialog keeps the last item while it closes, so its content does not vanish mid-animation.
	const [shownItemId, setShownItemId] = useState<string | null>(null);

	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const menuRows = buildMenuRows(items, orders);
	const soldOut = menuRows.filter((row) => !row.isAvailable).length;
	const tabs = MENU_CATEGORIES.map((value) => ({
		value,
		count: menuRows.filter((row) => row.category === value).length,
	})).filter((tab) => tab.count > 0);
	const rows =
		category === "all"
			? menuRows
			: menuRows.filter((row) => row.category === category);
	const shownRow = menuRows.find((row) => row.id === shownItemId);
	const categorySalesCents = shownRow
		? menuRows
				.filter((row) => row.category === shownRow.category)
				.reduce((sum, row) => sum + row.salesTodayCents, 0)
		: 0;

	function openItem(id: string) {
		setShownItemId(id);
		setOpenItemId(id);
	}

	// The phone sees the dish and its price first. The category comes last: the tabs already name it.
	const columns: DataTableColumn<MenuRow>[] = [
		{
			id: "dish",
			header: t("menu.dish"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<button
					type="button"
					onClick={() => openItem(row.id)}
					aria-label={fillMessage(t("menu.details"), { name: row.name })}
					className="grid min-w-44 justify-items-start whitespace-normal text-start outline-none hover:underline focus-visible:underline"
				>
					<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span className="font-medium">{row.name}</span>
						{row.isAvailable ? null : (
							<Badge variant="warning">{t("menu.soldOut")}</Badge>
						)}
					</span>
					<span className="text-muted-foreground text-xs">
						{row.description}
					</span>
				</button>
			),
		},
		{
			id: "price",
			header: t("menu.price"),
			align: "end",
			sortValue: (row) => row.priceCents,
			cell: (row) => (
				<span className="grid justify-items-end">
					<span className="font-medium">
						{formatCents(money, row.priceCents)}
					</span>
					<span className="@md/main:hidden text-muted-foreground text-xs">
						{fillMessage(t("menu.soldCount"), {
							count: number.format(row.soldToday),
						})}
					</span>
				</span>
			),
		},
		{
			id: "sold",
			header: t("menu.soldToday"),
			align: "end",
			sortValue: (row) => row.soldToday,
			cell: (row) => number.format(row.soldToday),
		},
		{
			id: "category",
			header: t("menu.category"),
			sortValue: (row) => MENU_CATEGORIES.indexOf(row.category),
			cell: (row) => (
				<span className="text-muted-foreground">
					{t(`menuCategories.${row.category}`)}
				</span>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("menu.title")}
				description={fillMessage(t("menu.description"), {
					count: number.format(menuRows.length),
					soldOut: number.format(soldOut),
				})}
				actions={
					<Button asChild>
						<Link to="/app/order">{t("menu.newOrder")}</Link>
					</Button>
				}
			/>
			{menuRows.length === 0 ? (
				<Card>
					<CardContent className="py-10 text-center text-muted-foreground text-sm">
						{t("menu.empty")}
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent>
						<DataTable
							rows={rows}
							columns={columns}
							searchText={(row) => `${row.name} ${row.description}`}
							noResults={t("menu.noResults")}
							toolbar={
								<Tabs
									value={category}
									onValueChange={(value) =>
										setCategory(
											MENU_CATEGORIES.find((option) => option === value) ??
												"all",
										)
									}
									className="max-w-full"
								>
									<TabsList className="h-auto flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto">
										<TabsTrigger value="all" className="h-8 flex-none">
											{t("menu.all")}
											<span className="tabular-nums opacity-70">
												{number.format(menuRows.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger
												key={tab.value}
												value={tab.value}
												className="h-8 flex-none"
											>
												{t(`menuCategories.${tab.value}`)}
												<span className="tabular-nums opacity-70">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
							}
						/>
					</CardContent>
				</Card>
			)}
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

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the menu loader runs. The route sets it as pendingComponent. */
export function MenuPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-60" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xl" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
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
