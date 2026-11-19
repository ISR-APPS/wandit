// The category row of the till screen: "All" and one square tile per menu category, each with its icon.
// OrderEntryPage renders it over the dish grid, as the kit POS category row. A tile is a toggle button.
// The tiles share the row width, down to 5 rem each, so every tile shows in full on a tablet.
// On a narrower column the row scrolls inside the page column, so the page never scrolls sideways.
import { ForkKnifeIcon } from "@phosphor-icons/react";
import {
	MENU_CATEGORIES,
	MENU_CATEGORY_ICON,
	type MenuCategory,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type CategoryTilesProps = {
	/** The chosen category, or "all" for the whole menu. */
	value: MenuCategory | "all";
	onValueChange: (value: MenuCategory | "all") => void;
};

/** The chosen tile has a primary border. aria-pressed tells a screen reader which tile is on. */
export function CategoryTiles({ value, onValueChange }: CategoryTilesProps) {
	const { t } = useT();
	const tiles = [
		{ key: "all" as const, icon: ForkKnifeIcon, label: t("orderEntry.all") },
		...MENU_CATEGORIES.map((category) => ({
			key: category,
			icon: MENU_CATEGORY_ICON[category],
			label: t(`menuCategories.${category}`),
		})),
	];

	return (
		<div className="max-w-full overflow-x-auto pb-1">
			<div className="flex gap-4">
				{tiles.map((tile) => (
					<button
						key={tile.key}
						type="button"
						aria-pressed={value === tile.key}
						onClick={() => onValueChange(tile.key)}
						className={cn(
							"flex min-w-20 flex-1 flex-col items-center gap-4 rounded-md border bg-card px-1 @4xl/main:py-6 py-3 text-center outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
							value === tile.key && "border-primary",
						)}
					>
						<tile.icon className="@4xl/main:size-10 size-8 text-primary" />
						<span className="max-w-full break-words text-sm leading-tight">
							{tile.label}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
