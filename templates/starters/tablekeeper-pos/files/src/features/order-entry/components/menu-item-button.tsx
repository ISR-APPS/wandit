// One dish or drink on the order screen: a large tap target with the name, a short line, and the price.
// MenuPicker renders one per item. A tap adds one portion to the ticket. A sold-out item is disabled.
// The count in the corner shows the portions of this item on the ticket now.
import {
	fillMessage,
	formatCents,
	type MenuItem,
	moneyFormat,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type MenuItemButtonProps = {
	item: MenuItem;
	/** Portions of this item on the ticket now. 0 hides the count. */
	quantityInCart: number;
	onAdd: () => void;
};

/** A button tile. Its focus ring and its pressed look come from the tokens. */
export function MenuItemButton({
	item,
	quantityInCart,
	onAdd,
}: MenuItemButtonProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);

	return (
		<button
			type="button"
			disabled={!item.isAvailable}
			onClick={onAdd}
			aria-label={fillMessage(t("orderEntry.add"), { name: item.name })}
			className={cn(
				"relative grid min-h-28 content-between gap-3 rounded-surface border bg-card p-4 text-start shadow-surface outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 active:translate-y-px disabled:cursor-not-allowed disabled:bg-canvas disabled:shadow-none",
				quantityInCart > 0 && "border-primary/60",
			)}
		>
			<span className="grid gap-1 pe-6">
				<span
					className={cn(
						"font-semibold text-sm leading-snug",
						!item.isAvailable && "text-muted-foreground",
					)}
				>
					{item.name}
				</span>
				<span className="line-clamp-2 text-muted-foreground text-xs">
					{item.description}
				</span>
			</span>
			<span className="flex items-center justify-between gap-2">
				<span
					className={cn(
						"font-numeric font-semibold tabular-nums",
						!item.isAvailable && "text-muted-foreground line-through",
					)}
				>
					{formatCents(money, item.priceCents)}
				</span>
				{item.isAvailable ? null : (
					<span className="text-warning text-xs">
						{t("orderEntry.soldOut")}
					</span>
				)}
			</span>
			{quantityInCart > 0 ? (
				<span className="absolute end-3 top-3 flex size-6 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground text-xs tabular-nums">
					{quantityInCart}
				</span>
			) : null}
		</button>
	);
}
