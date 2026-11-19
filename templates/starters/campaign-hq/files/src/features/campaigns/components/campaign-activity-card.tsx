// The activity card of a campaign page: its events as a line timeline, the newest first, with a "Latest" badge.
// CampaignDetailPage renders it at the top of the 2/3 column (3 events) and in the Activity tab (every event).
// Each event shows an icon on the line, one sentence, the time, and what the event means for the campaign.
import {
	ClockIcon,
	FlagIcon,
	type Icon,
	PauseIcon,
	RocketLaunchIcon,
	SealCheckIcon,
	SparkleIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import {
	type CampaignEventKind,
	dateTimeFormat,
	fillMessage,
	formatRelativeTime,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { CampaignDetail } from "../api/campaigns.queries";

/** The icon of each event kind. */
const EVENT_ICON = {
	brief_approved: SealCheckIcon,
	launched: RocketLaunchIcon,
	audience_added: UsersThreeIcon,
	creative_refreshed: SparkleIcon,
	paused: PauseIcon,
	ended: FlagIcon,
} satisfies Record<CampaignEventKind, Icon>;

type CampaignActivityCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
	/** The time of the render, in milliseconds since 1970. */
	now: number;
	/** Shows only the newest events. Absent: every event. */
	limit?: number;
	/** Opens the Activity tab. Absent in that tab: the card then has no "View all" action. */
	onViewAll?: () => void;
};

/** A campaign with no event shows one sentence. */
export function CampaignActivityCard({
	campaign,
	now,
	limit,
	onViewAll,
}: CampaignActivityCardProps) {
	const { t, locale } = useT();
	const events =
		limit === undefined ? campaign.events : campaign.events.slice(0, limit);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("campaigns.latestActivity")}</CardTitle>
				{onViewAll && campaign.events.length > events.length ? (
					<CardAction>
						<Button
							type="button"
							variant="link"
							size="sm"
							className="h-auto p-0 text-muted-foreground"
							onClick={onViewAll}
						>
							{t("common.viewAll")}
						</Button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="ps-9">
				{events.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("campaigns.noEvents")}
					</p>
				) : (
					<ol className="relative border-s">
						{events.map((event, index) => {
							const EventIcon = EVENT_ICON[event.kind];
							return (
								<li
									key={event.id}
									className={cn(
										"ms-6 grid gap-2",
										index < events.length - 1 && "mb-8",
									)}
								>
									<span className="absolute -start-3 flex size-6 items-center justify-center rounded-full border bg-muted">
										<EventIcon className="size-3 text-primary" />
									</span>
									<h3 className="flex flex-wrap items-center gap-2 font-sans font-semibold">
										{fillMessage(t(`eventsHere.${event.kind}`), {
											actor: event.actorName,
											audience: event.audienceName ?? "",
										})}
										{index === 0 ? (
											<Badge variant="outline">{t("campaigns.latest")}</Badge>
										) : null}
									</h3>
									<p className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none">
										<ClockIcon className="size-3" aria-hidden="true" />
										<time dateTime={event.occurredAt}>
											{formatRelativeTime(event.occurredAt, now, locale)}
										</time>
										<span aria-hidden="true">·</span>
										<span>
											{dateTimeFormat(locale).format(
												new Date(event.occurredAt),
											)}
										</span>
									</p>
									<p className="text-muted-foreground text-sm">
										{t(`eventDetails.${event.kind}`)}
									</p>
								</li>
							);
						})}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
