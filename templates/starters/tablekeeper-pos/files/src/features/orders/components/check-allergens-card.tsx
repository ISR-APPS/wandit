// The allergens of one check: the declared allergens of every dish on it, as outline badges.
// OrderDetailPage renders it last in the start column, in the place of the kit "skills" card.
// The allergens come from the menu items of the lines. A line of an item that left the menu adds none.
import type { MenuItem, Order } from "~/features/restaurant";
import { ALLERGENS } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type CheckAllergensCardProps = {
	order: Order;
	/** The menu of the day, from menuQueryOptions. */
	menu: MenuItem[];
};

/** The badges follow the order of the allergen list of the menu, so two checks read the same way. */
export function CheckAllergensCard({ order, menu }: CheckAllergensCardProps) {
	const { t } = useT();
	const itemIds = new Set(order.lines.map((line) => line.menuItemId));
	const present = new Set(
		menu
			.filter((item) => itemIds.has(item.id))
			.flatMap((item) => item.allergens),
	);
	const allergens = ALLERGENS.filter((allergen) => present.has(allergen));

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orderDetail.allergens")}</CardTitle>
			</CardHeader>
			<CardContent>
				{allergens.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("orderDetail.noAllergens")}
					</p>
				) : (
					<ul className="flex flex-wrap gap-2">
						{allergens.map((allergen) => (
							<li key={allergen}>
								<Badge variant="outline">{t(`allergens.${allergen}`)}</Badge>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
