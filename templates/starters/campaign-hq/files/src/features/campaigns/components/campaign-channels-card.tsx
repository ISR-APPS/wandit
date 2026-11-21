// The channels card of a campaign page: one outline badge per channel of the media plan.
// CampaignDetailPage renders it last in its 1/3 column. It follows the kit "skills" card.
import { ChannelMark } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { CampaignDetail } from "../api/campaigns.queries";

type CampaignChannelsCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
};

/** The colored mark of each badge is the color of the channel in every chart. */
export function CampaignChannelsCard({ campaign }: CampaignChannelsCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("campaigns.channels")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-wrap gap-2">
					{campaign.channels.map((channel) => (
						<li key={channel}>
							<Badge variant="outline">
								<ChannelMark channel={channel} />
								{t(`channels.${channel}`)}
							</Badge>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
