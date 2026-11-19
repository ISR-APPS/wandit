// The budget card of a campaign page: the spent share of the approved budget as one bar, and the pace.
// CampaignDetailPage renders it in its 1/3 column, under the profile card.
// The pace shows only while the campaign is live (pacingOf in lib/pacing.ts).
import {
	CAMPAIGN_STATUS_BADGE,
	fillMessage,
	moneyFormat,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { CampaignDetail } from "../api/campaigns.queries";
import { PACING_BADGE } from "../lib/pacing";

type CampaignBudgetCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
};

/** A live campaign shows its pace badge in the header. Another status shows its status color there. */
export function CampaignBudgetCard({ campaign }: CampaignBudgetCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const used =
		campaign.budget === 0 ? 0 : campaign.totals.spend / campaign.budget;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("campaigns.pacingTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("campaigns.spentOf"), {
						spent: money.format(campaign.totals.spend),
						budget: money.format(campaign.budget),
					})}
				</CardDescription>
				<CardAction>
					{campaign.pacing ? (
						<Badge variant={PACING_BADGE[campaign.pacing.state]}>
							{t(`pacing.${campaign.pacing.state}`)}
						</Badge>
					) : (
						<Badge variant={CAMPAIGN_STATUS_BADGE[campaign.status]}>
							{t(`campaignStatus.${campaign.status}`)}
						</Badge>
					)}
				</CardAction>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress value={used * 100} aria-label={t("campaigns.budget")} />
				<span className="text-muted-foreground text-sm tabular-nums">
					{percent.format(used)}
				</span>
			</CardContent>
		</Card>
	);
}
