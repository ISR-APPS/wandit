// The statuses and objectives of a campaign, and the Badge variant of each status.
// The sample tables derive the status from the flight dates. The list, the detail page, and the home read it.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every status, in the order of the work. The tabs and the home status panel follow this order. */
export const CAMPAIGN_STATUSES = [
	"live",
	"planned",
	"paused",
	"ended",
] as const;

/** One status. Its label is the message key `campaignStatus.<status>`. */
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** What a campaign must achieve. It sets how a click turns into a conversion in the sample tables. */
export const CAMPAIGN_OBJECTIVES = [
	"awareness",
	"traffic",
	"leads",
	"sales",
] as const;

/** One objective. Its label is the message key `objectives.<objective>`. */
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

/** The Badge variant names of the kit. */
export type BadgeVariant = NonNullable<
	VariantProps<typeof badgeVariants>["variant"]
>;

/** Badge variant per status. Live is the only green one, paused the only amber one. */
export const CAMPAIGN_STATUS_BADGE = {
	live: "success",
	planned: "info",
	paused: "warning",
	ended: "outline",
} satisfies Record<CampaignStatus, BadgeVariant>;
