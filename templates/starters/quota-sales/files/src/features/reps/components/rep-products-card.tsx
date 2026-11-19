// The product lines card of the rep page: one outline badge per product line that the rep sold this quarter.
// RepDetailPage renders it under the quota card. The largest line comes first; each badge shows its amount.
import { moneyFormat } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { RepDetail } from "../api/reps.queries";

type RepProductsCardProps = {
	/** The booked amount per product line of the quarter, largest first. */
	productMix: RepDetail["productMix"];
};

/** No sale yet shows one muted sentence. */
export function RepProductsCard({ productMix }: RepProductsCardProps) {
	const { t, locale } = useT();
	const compactMoney = moneyFormat(locale, { compact: true });
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reps.productsTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				{productMix.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("reps.productsEmpty")}
					</p>
				) : (
					<ul className="flex flex-wrap gap-2">
						{productMix.map((item) => (
							<li key={item.productLine}>
								<Badge variant="outline" className="gap-1.5">
									{t(`productLines.${item.productLine}`)}
									<span className="text-muted-foreground tabular-nums">
										{compactMoney.format(item.amount)}
									</span>
								</Badge>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
