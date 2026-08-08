// Where one order came from, as a quiet pill: Facebook / TikTok (derived
// server-side from the ad platforms' click ids and utm_source) or Direct.
// When the ad link carried utm_campaign, the badge's tooltip names the
// exact campaign — the merchant's "which ad money worked" answer, inline.

import type { Lead } from "@wandit/contracts";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";

// Exported for the dashboard Leads page's source filter dots.
export const SOURCE_DOT_CLASS: Record<Lead["source"], string> = {
	// Meta's brand blue; TikTok reads as the strong neutral; direct stays calm.
	direct: "bg-stone",
	facebook: "bg-[#1877F2]",
	tiktok: "bg-foreground",
};

export function LeadSourceBadge({
	campaign,
	source,
}: {
	campaign: string | null;
	source: Lead["source"];
}) {
	const { t } = useTranslation();
	const badge = (
		<span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
			<span
				aria-hidden
				className={cn(
					"size-1.5 shrink-0 rounded-full",
					SOURCE_DOT_CLASS[source],
				)}
			/>
			{t(`leads.source.${source}`)}
		</span>
	);

	if (!campaign) {
		return badge;
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>{badge}</TooltipTrigger>
			<TooltipContent dir="auto">
				{t("leads.campaignTooltip", { campaign })}
			</TooltipContent>
		</Tooltip>
	);
}
