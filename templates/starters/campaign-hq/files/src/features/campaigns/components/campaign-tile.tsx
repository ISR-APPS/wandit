// One campaign of the list page as a card: name, client, flight, budget used, the team, and the time left.
// CampaignsPage renders one per campaign in a grid. The whole card links to the campaign page.
// It follows the kit project card: title, subtitle, date, a progress block, then avatars and a badge.
import { Link } from "@tanstack/react-router";
import {
	CAMPAIGN_STATUS_BADGE,
	type CampaignStatus,
	calendarDaysFromNow,
	fillMessage,
	formatFlight,
	initialsOf,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { Campaign } from "../api/campaigns.queries";
import { CAMPAIGN_STATUS_BAR } from "../lib/status-bar";

type CampaignTileProps = {
	campaign: Campaign;
	/** The time of the render, in milliseconds since 1970. */
	now: number;
};

// The badge text of each status: the time left, the start, the pause, or the end.
function timeLabel(
	campaign: Campaign,
	now: number,
	locale: string,
	t: ReturnType<typeof useT>["t"],
): string {
	const days = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const date = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
	});
	const statusLabel: Record<CampaignStatus, () => string> = {
		// The last day of the flight counts as a day left.
		live: () =>
			fillMessage(t("campaigns.daysLeft"), {
				days: days.format(calendarDaysFromNow(campaign.endAt, now) + 1),
			}),
		planned: () =>
			fillMessage(t("campaigns.startsIn"), {
				days: days.format(calendarDaysFromNow(campaign.startAt, now)),
			}),
		paused: () =>
			fillMessage(t("campaigns.pausedOn"), {
				date: date.format(new Date(campaign.pausedAt ?? campaign.endAt)),
			}),
		ended: () =>
			fillMessage(t("campaigns.endedOn"), {
				date: date.format(new Date(campaign.endAt)),
			}),
	};
	return statusLabel[campaign.status]();
}

/** The progress bar shows the spend against the approved budget, in the color of the status. */
export function CampaignTile({ campaign, now }: CampaignTileProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const used =
		campaign.budget === 0 ? 0 : campaign.totals.spend / campaign.budget;

	return (
		<Link
			to="/app/campaigns/$campaignId"
			params={{ campaignId: campaign.id }}
			className="group/tile rounded-(--surface-radius) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<Card className="h-full transition-colors group-hover/tile:border-ring">
				<CardHeader>
					<CardTitle className="leading-snug" dir="auto">
						{campaign.name}
					</CardTitle>
					<CardDescription dir="auto">{campaign.client}</CardDescription>
				</CardHeader>
				<CardContent className="mt-auto">
					<p className="mb-4 text-muted-foreground text-sm">
						{formatFlight(campaign.startAt, campaign.endAt, locale)}
					</p>
					<div className="mb-6">
						<div className="mb-2 flex items-center justify-between">
							<span className="text-sm">{t("campaigns.budget")}</span>
							<span className="font-semibold text-sm tabular-nums">
								{percent.format(used)}
							</span>
						</div>
						<Progress
							value={used * 100}
							className={CAMPAIGN_STATUS_BAR[campaign.status]}
							aria-label={t("campaigns.budget")}
						/>
					</div>
					<div className="flex items-center justify-between gap-2">
						<div className="flex -space-x-2 rtl:space-x-reverse">
							{campaign.team.map((name) => (
								<Avatar key={name} className="size-8 ring-2 ring-card">
									<AvatarFallback className="text-xs" title={name}>
										{initialsOf(name)}
									</AvatarFallback>
								</Avatar>
							))}
						</div>
						<Badge
							variant={CAMPAIGN_STATUS_BADGE[campaign.status]}
							className="shrink-0"
						>
							{timeLabel(campaign, now, locale, t)}
						</Badge>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}
