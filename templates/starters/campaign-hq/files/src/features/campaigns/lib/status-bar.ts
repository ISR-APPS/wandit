// The progress bar color of each campaign status, so a campaign card reads its status at a glance.
// CampaignTile passes the class to Progress. The badge beside it keeps the status word.
import type { CampaignStatus } from "~/features/marketing";

/**
 * A class that colors the indicator of the base Progress, which draws ink by default.
 * The names stay whole in the code, so Tailwind finds them.
 */
export const CAMPAIGN_STATUS_BAR = {
	live: "[&>[data-slot=progress-indicator]]:bg-success",
	planned: "[&>[data-slot=progress-indicator]]:bg-info",
	paused: "[&>[data-slot=progress-indicator]]:bg-warning",
	ended: "[&>[data-slot=progress-indicator]]:bg-muted-foreground",
} satisfies Record<CampaignStatus, string>;
