// The status word of a campaign in a colored badge: Live, Planned, Paused, or Ended.
// The campaign table, the campaign page, the home panels, and the audience panel render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	CAMPAIGN_STATUS_BADGE,
	type CampaignStatus,
} from "../lib/campaign-status";

type CampaignStatusBadgeProps = {
	status: CampaignStatus;
};

/** A status is a word plus a color, never a color alone. */
export function CampaignStatusBadge({ status }: CampaignStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={CAMPAIGN_STATUS_BADGE[status]}>
			{t(`campaignStatus.${status}`)}
		</Badge>
	);
}
