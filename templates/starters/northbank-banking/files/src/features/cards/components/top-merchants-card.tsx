// The 5 merchants with the most spend of one card in the last 30 days.
// CardDetailPage renders it beside the monthly limit.
import { countLabel, MoneyText } from "~/features/bank";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { CardDetail } from "../lib/card-spend";

type DetailCardProps = {
	/** The card, its payments, and its top merchants, from cardDetailQueryOptions. */
	detail: CardDetail;
};

/** The merchants with the most spend in the last 30 days. */
export function TopMerchantsCard({ detail }: DetailCardProps) {
	const { t, locale } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("cards.merchantsTitle")}</CardTitle>
				<CardDescription>{t("cards.merchantsDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				{detail.topMerchants.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("cards.noSpend")}</p>
				) : (
					<ul className="grid gap-3 text-sm">
						{detail.topMerchants.map((merchant) => (
							<li key={merchant.name} className="flex items-baseline gap-3">
								<span className="grid min-w-0 flex-1">
									<span className="truncate font-medium">{merchant.name}</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{countLabel(
											merchant.count,
											t("cards.paymentOne"),
											t("cards.paymentOther"),
											locale,
										)}
									</span>
								</span>
								<MoneyText amountCents={merchant.totalCents} />
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
