// The ticket tiers of one event: the share sold of each tier quota, with the price and the revenue.
// EventDetailPage renders it in the start column under the profile card. The quotas of the tiers add up to the capacity.
// It follows the kit "complete your profile" card: a labeled progress bar with the percent at the end.
import { moneyFormat, type TierSales } from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

type TicketTiersCardProps = {
	tiers: TierSales[];
};

/** One row per tier. A full tier shows "Sold out" after its revenue, so the revenue lines still add up. */
export function TicketTiersCard({ tiers }: TicketTiersCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("events.tiers")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-5">
				{tiers.map((tier) => (
					<div key={tier.id} className="grid gap-2">
						<div className="flex items-baseline justify-between gap-3 text-sm">
							<span className="font-medium" dir="auto">
								{`${tier.name} · ${money.format(tier.price)}`}
							</span>
							<span className="text-muted-foreground tabular-nums">
								{percent.format(tier.quota === 0 ? 0 : tier.sold / tier.quota)}
							</span>
						</div>
						<Progress
							value={tier.sold}
							max={tier.quota}
							className="h-2"
							aria-label={tier.name}
						/>
						<div className="flex items-baseline justify-between gap-3 text-muted-foreground text-xs tabular-nums">
							<span>{`${number.format(tier.sold)} / ${number.format(tier.quota)}`}</span>
							<span>
								{money.format(tier.gross)}
								{tier.sold >= tier.quota
									? ` · ${t("events.tierSoldOut")}`
									: null}
							</span>
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
