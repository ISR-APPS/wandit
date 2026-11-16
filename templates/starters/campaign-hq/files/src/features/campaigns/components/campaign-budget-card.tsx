// The "Budget" panel of a campaign: the spend of the approved budget, the day of the flight, and the pace.
// CampaignDetailPage renders it first in its rail. Only a live campaign has a pace and a projection.
import {
	calendarDaysFromNow,
	dayCountFormat,
	fillMessage,
	moneyFormat,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { CampaignDetail } from "../api/campaigns.queries";
import { PACING_BADGE } from "../lib/pacing";

type CampaignBudgetCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
	/** The time of the render, in milliseconds since 1970. */
	now: number;
};

/** The bar is the spend against the budget. The note under it depends on the status. */
export function CampaignBudgetCard({ campaign, now }: CampaignBudgetCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const { pacing } = campaign;
	const spentLabel = fillMessage(t("campaigns.spentOf"), {
		spent: money.format(campaign.totals.spend),
		budget: money.format(campaign.budget),
	});
	const note =
		campaign.status === "planned"
			? fillMessage(t("campaigns.plannedBudget"), {
					days: dayCountFormat(locale).format(
						calendarDaysFromNow(campaign.startAt, now),
					),
				})
			: pacing
				? fillMessage(t("campaigns.projected"), {
						amount: money.format(pacing.projectedSpend),
					})
				: t("campaigns.notLive");

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("campaigns.pacingTitle")}</CardTitle>
				{pacing ? (
					<CardAction>
						<Badge variant={PACING_BADGE[pacing.state]}>
							{t(`pacing.${pacing.state}`)}
						</Badge>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="grid gap-3">
				<p className="font-numeric text-3xl tabular-nums">
					{percent.format(campaign.totals.spend / campaign.budget)}
				</p>
				<Progress
					value={campaign.totals.spend}
					max={campaign.budget}
					aria-label={spentLabel}
				/>
				<div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
					<span className="tabular-nums">{spentLabel}</span>
					{campaign.status === "live" ? (
						<span className="text-muted-foreground tabular-nums">
							{fillMessage(t("campaigns.dayOfFlight"), {
								day: number.format(campaign.elapsedDays + 1),
								total: number.format(campaign.flightDays),
							})}
						</span>
					) : null}
				</div>
				<p className="text-muted-foreground text-sm">{note}</p>
			</CardContent>
		</Card>
	);
}
