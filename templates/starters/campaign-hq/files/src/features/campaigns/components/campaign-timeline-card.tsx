// The "Timeline" panel of a campaign: its events, newest first, from the brief to the end of the flight.
// CampaignDetailPage renders it in its rail.
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { CampaignDetail } from "../api/campaigns.queries";
import { CampaignEventItem } from "./campaign-event-item";

type CampaignTimelineCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
	/** The time of the render, in milliseconds since 1970. */
	now: number;
};

/** A planned campaign whose brief is still in the future has no event yet, so it shows the empty line. */
export function CampaignTimelineCard({
	campaign,
	now,
}: CampaignTimelineCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("campaigns.timeline")}</CardTitle>
			</CardHeader>
			<CardContent>
				{campaign.events.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("campaigns.noEvents")}
					</p>
				) : (
					<ol className="grid gap-4">
						{campaign.events.map((event) => (
							<CampaignEventItem key={event.id} event={event} now={now} />
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
