// One dish or drink of the till screen, in the anatomy of the kit POS product card.
// A tinted top area with the category icon (the app has no food photos), then the name, the price, and an add button.
// OrderEntryPage renders one per item of the chosen category. A sold-out item shows its state and cannot be added.
import { ShoppingCartSimpleIcon } from "@phosphor-icons/react";
import {
	fillMessage,
	formatCents,
	MENU_CATEGORY_ICON,
	type MenuCategory,
	type MenuItem,
	moneyFormat,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";

// Each category keeps one chart color, so the grid reads by course at a glance. The tile also names the dish.
const CATEGORY_TINT = {
	starters: "bg-chart-1/15 text-chart-1",
	mains: "bg-chart-2/15 text-chart-2",
	sides: "bg-chart-3/15 text-chart-3",
	desserts: "bg-chart-4/15 text-chart-4",
	drinks: "bg-chart-5/15 text-chart-5",
} satisfies Record<MenuCategory, string>;

type DishCardProps = {
	item: MenuItem;
	/** Portions of this item on the ticket now. 0 hides the count. */
	quantityInCart: number;
	onAdd: () => void;
};

/** The add button carries the dish name in its label, so a screen reader hears what it adds. */
export function DishCard({ item, quantityInCart, onAdd }: DishCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const CategoryIcon = MENU_CATEGORY_ICON[item.category];
	const addLabel = fillMessage(t("orderEntry.add"), { name: item.name });

	return (
		<div
			className={cn(
				"flex flex-col overflow-hidden rounded-md border bg-card",
				quantityInCart > 0 && "border-primary",
			)}
		>
			<div
				className={cn(
					"relative flex aspect-4/3 items-center justify-center",
					CATEGORY_TINT[item.category],
					!item.isAvailable && "opacity-50",
				)}
			>
				<CategoryIcon aria-hidden="true" className="size-12" />
				{quantityInCart > 0 ? (
					<span className="absolute end-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground text-xs tabular-nums">
						{quantityInCart}
					</span>
				) : null}
			</div>
			<div className="flex flex-1 flex-col gap-1 p-4">
				{/* A long name wraps. The price row then sits at the bottom, level with the other cards of the row. */}
				<h3 className="text-pretty font-semibold" dir="auto">
					{item.name}
				</h3>
				<div className="mt-auto flex items-center justify-between gap-2">
					{item.isAvailable ? (
						<span className="text-muted-foreground tabular-nums">
							{formatCents(money, item.priceCents)}
						</span>
					) : (
						<Badge variant="warning">{t("orderEntry.soldOut")}</Badge>
					)}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="icon"
								disabled={!item.isAvailable}
								aria-label={addLabel}
								onClick={onAdd}
							>
								<ShoppingCartSimpleIcon />
							</Button>
						</TooltipTrigger>
						<TooltipContent>{t("orderEntry.addToTicket")}</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</div>
	);
}
