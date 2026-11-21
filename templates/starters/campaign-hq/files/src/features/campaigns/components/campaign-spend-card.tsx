// The spend card of a campaign page: spend per day as stacked areas, one per channel of the media plan.
// CampaignDetailPage renders it in its 2/3 column when the campaign has results. The chart loads with React.lazy.
import { lazy, Suspense } from "react";
import {
	ChannelLegend,
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
import { Skeleton } from "~/shared/ui/skeleton";
import type { CampaignDetail } from "../api/campaigns.queries";

const CampaignSpendArea = lazy(() =>
	import("./campaign-spend-area").then((module) => ({
		default: module.CampaignSpendArea,
	})),
);

type CampaignSpendCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
};

/** The chart shows the newest 90 days of the flight at most. The hint names the count of days. */
export function CampaignSpendCard({ campaign }: CampaignSpendCardProps) {
	const { t, locale } = useT();
	const dayCount = new Set(campaign.dailySpend.map((point) => point.day)).size;
	return (
		<Card>
			<CardHeader className="gap-2">
				<CardTitle>{t("campaigns.spendPerDay")}</CardTitle>
				<CardDescription>
					{fillMessage(t("campaigns.spendPerDayHint"), {
						days: dayCountFormat(locale).format(dayCount),
					})}
				</CardDescription>
				<ChannelLegend channels={campaign.channels} className="pt-1" />
			</CardHeader>
			<CardContent>
				<Suspense fallback={<Skeleton className="h-64 w-full" />}>
					<CampaignSpendArea
						points={campaign.dailySpend}
						channels={campaign.channels}
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}
