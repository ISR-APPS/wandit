// The dialog with the details of one dish or drink: the price, the VAT, the allergens, and its sales today.
// MenuPage opens it when a dish name is clicked. It shows data only; it writes nothing.
// The share of category compares the item with the other items of the same category today.
import {
	ALLERGENS,
	fillMessage,
	formatCents,
	formatRelativeTime,
	moneyFormat,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import { Progress } from "~/shared/ui/progress";
import type { MenuRow } from "../lib/menu-sales";

type MenuItemDialogProps = {
	/** The item to show. The dialog keeps it while it closes. */
	row: MenuRow | undefined;
	/** Sales of the whole category of the item today, in cents. The share bar divides by it. */
	categorySalesCents: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A controlled dialog. Its numbers come from the same checks as the menu table. */
export function MenuItemDialog({
	row,
	categorySalesCents,
	open,
	onOpenChange,
}: MenuItemDialogProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const now = Date.now();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				{row ? (
					<>
						<DialogHeader>
							<DialogTitle className="font-display text-xl">
								{row.name}
							</DialogTitle>
							<DialogDescription>{row.description}</DialogDescription>
						</DialogHeader>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<span className="font-numeric font-semibold text-3xl tabular-nums">
								{formatCents(money, row.priceCents)}
							</span>
							<span className="flex flex-wrap items-center gap-2">
								<Badge variant="secondary">
									{t(`menuCategories.${row.category}`)}
								</Badge>
								<Badge variant="outline">{t(`stations.${row.station}`)}</Badge>
								<Badge variant={row.isAvailable ? "success" : "warning"}>
									{t(row.isAvailable ? "menu.available" : "menu.soldOut")}
								</Badge>
							</span>
						</div>
						<p className="text-muted-foreground text-xs">
							{fillMessage(t("menu.vat"), {
								rate: percent.format(row.vatRate),
							})}
						</p>
						<dl className="grid grid-cols-2 gap-4 rounded-surface bg-muted p-4 text-sm">
							<div className="grid gap-1">
								<dt className="text-muted-foreground">{t("menu.soldToday")}</dt>
								<dd className="font-numeric font-semibold text-lg tabular-nums">
									{row.soldToday}
								</dd>
							</div>
							<div className="grid gap-1">
								<dt className="text-muted-foreground">
									{t("menu.salesToday")}
								</dt>
								<dd className="font-numeric font-semibold text-lg tabular-nums">
									{formatCents(money, row.salesTodayCents)}
								</dd>
							</div>
							<div className="col-span-2 grid gap-2">
								<dt className="flex justify-between gap-3 text-muted-foreground">
									{fillMessage(t("menu.shareOfCategory"), {
										category: t(
											`menuCategories.${row.category}`,
										).toLocaleLowerCase(locale),
									})}
									<span className="text-foreground tabular-nums">
										{percent.format(
											categorySalesCents === 0
												? 0
												: row.salesTodayCents / categorySalesCents,
										)}
									</span>
								</dt>
								<dd>
									<Progress
										value={row.salesTodayCents}
										max={Math.max(1, categorySalesCents)}
									/>
								</dd>
							</div>
							<div className="col-span-2 grid gap-1">
								<dt className="text-muted-foreground">
									{t("menu.lastOrdered")}
								</dt>
								<dd>
									{row.lastOrderedAt
										? formatRelativeTime(row.lastOrderedAt, now, locale)
										: t("menu.neverToday")}
								</dd>
							</div>
						</dl>
						<div className="grid gap-2">
							<h3 className="font-medium text-sm">{t("menu.allergens")}</h3>
							{row.allergens.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									{t("menu.noAllergens")}
								</p>
							) : (
								<div className="flex flex-wrap gap-1.5">
									{ALLERGENS.filter((allergen) =>
										row.allergens.includes(allergen),
									).map((allergen) => (
										<Badge key={allergen} variant="outline">
											{t(`allergens.${allergen}`)}
										</Badge>
									))}
								</div>
							)}
						</div>
					</>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
