// The "Spend per day" panel of a campaign: one stacked bar per day, split by the channels of its plan.
// CampaignDetailPage renders it in its main column when the campaign has results.
import {
	ChannelLegend,
	ChannelStackChart,
	CURRENCY,
	dayCountFormat,
	fillMessage,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { CampaignDetail } from "../api/campaigns.queries";

type CampaignSpendCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
};

/** The chart shows the newest 90 days of the flight at most. The hint names the count of days. */
export function CampaignSpendCard({ campaign }: CampaignSpendCardProps) {
	const { t, locale } = useT();
	const title = t("campaigns.spendPerDay");
	const dayCount = new Set(campaign.dailySpend.map((point) => point.day)).size;
	return (
		<Card>
			<CardHeader className="gap-2">
				<CardTitle>{title}</CardTitle>
				<CardDescription>
					{fillMessage(t("campaigns.spendPerDayHint"), {
						days: dayCountFormat(locale).format(dayCount),
					})}
				</CardDescription>
				<ChannelLegend channels={campaign.channels} className="pt-1" />
			</CardHeader>
			<CardContent>
				<ChannelStackChart
					points={campaign.dailySpend}
					channels={campaign.channels}
					title={title}
					valueFormat={{
						style: "currency",
						currency: CURRENCY,
						maximumFractionDigits: 0,
					}}
					className="h-56"
				/>
			</CardContent>
		</Card>
	);
}
