// The menu side of the order screen: the category tabs, the search field, and the grid of item buttons.
// OrderEntryPage renders it beside the ticket. "All" groups the items under their category headings.
// It keeps the tab and the search in local state. A tap calls onAdd with the item id.
import { useState } from "react";
import {
	MENU_CATEGORIES,
	type MenuCategory,
	type MenuItem,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { MagnifyingGlassIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import type { CartLine } from "../lib/cart";
import { MenuItemButton } from "./menu-item-button";

type MenuPickerProps = {
	/** Every menu item, in the order of the printed menu. */
	items: MenuItem[];
	/** The ticket in progress, for the count on each button. */
	cart: CartLine[];
	onAdd: (menuItemId: string) => void;
};

/** Tabs and a search on top, then one grid per category. */
export function MenuPicker({ items, cart, onAdd }: MenuPickerProps) {
	const { t, locale } = useT();
	const [category, setCategory] = useState<MenuCategory | "all">("all");
	const [query, setQuery] = useState("");
	const needle = query.trim().toLocaleLowerCase(locale);
	const matches = items.filter(
		(item) =>
			(category === "all" || item.category === category) &&
			(needle === "" ||
				`${item.name} ${item.description}`
					.toLocaleLowerCase(locale)
					.includes(needle)),
	);
	const groups = MENU_CATEGORIES.map((value) => ({
		category: value,
		items: matches.filter((item) => item.category === value),
	})).filter((group) => group.items.length > 0);
	const quantityOf = (menuItemId: string) =>
		cart.find((line) => line.menuItemId === menuItemId)?.quantity ?? 0;

	return (
		<div className="grid content-start gap-5">
			<div className="flex flex-wrap items-center gap-3">
				<Tabs
					value={category}
					onValueChange={(value) =>
						setCategory(
							MENU_CATEGORIES.find((option) => option === value) ?? "all",
						)
					}
					className="max-w-full overflow-x-auto"
				>
					<TabsList>
						<TabsTrigger value="all">{t("orderEntry.all")}</TabsTrigger>
						{MENU_CATEGORIES.map((value) => (
							<TabsTrigger key={value} value={value}>
								{t(`menuCategories.${value}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				{/* The search fills the rest of the tab row, or a full row of its own when the row is too narrow. */}
				<div className="relative min-w-48 flex-1">
					<MagnifyingGlassIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t("orderEntry.search")}
						aria-label={t("orderEntry.search")}
						className="ps-8"
					/>
				</div>
			</div>
			{groups.length === 0 ? (
				<p className="py-10 text-center text-muted-foreground text-sm">
					{t("orderEntry.noResults")}
				</p>
			) : (
				groups.map((group) => (
					<section key={group.category} className="grid gap-3">
						<h2 className="font-semibold text-muted-foreground text-sm">
							{t(`menuCategories.${group.category}`)}
						</h2>
						{/* Beside the ticket (from 48rem) the menu column is narrow again, so it drops back to 2 columns. */}
						<div className="grid @3xl/main:grid-cols-2 @5xl/main:grid-cols-3 @6xl/main:grid-cols-4 @xl/main:grid-cols-3 grid-cols-2 gap-3">
							{group.items.map((item) => (
								<MenuItemButton
									key={item.id}
									item={item}
									quantityInCart={quantityOf(item.id)}
									onAdd={() => onAdd(item.id)}
								/>
							))}
						</div>
					</section>
				))
			)}
		</div>
	);
}
