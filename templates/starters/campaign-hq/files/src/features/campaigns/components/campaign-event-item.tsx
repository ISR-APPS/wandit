// One event of a campaign as a list item: an icon for its kind, its time, and one sentence.
// The campaign timeline panel and the home activity panel render it. The home links the campaign name to its page.
import {
	FlagIcon,
	type Icon,
	PauseIcon,
	RocketLaunchIcon,
	SealCheckIcon,
	SparkleIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	type CampaignEventKind,
	dateTimeFormat,
	formatRelativeTime,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import type { CampaignEvent } from "../api/campaigns.queries";

/** The icon of each event kind. */
const EVENT_ICON = {
	brief_approved: SealCheckIcon,
	launched: RocketLaunchIcon,
	audience_added: UsersThreeIcon,
	creative_refreshed: SparkleIcon,
	paused: PauseIcon,
	ended: FlagIcon,
} satisfies Record<CampaignEventKind, Icon>;

type CampaignEventItemProps = {
	/** One event of campaignQueryOptions or of the home activity query. */
	event: CampaignEvent;
	/** The time of the render, in milliseconds since 1970. */
	now: number;
	/** True on the home: the sentence names the campaign and links it. False on the campaign page: no name. */
	linkCampaign?: boolean;
};

/**
 * On the home the sentence comes from `events.<kind>`, and its {campaign} part is a link.
 * On the campaign page it comes from `eventsHere.<kind>`, which does not repeat the campaign name.
 */
export function CampaignEventItem({
	event,
	now,
	linkCampaign = false,
}: CampaignEventItemProps) {
	const { t, locale } = useT();
	const EventIcon = EVENT_ICON[event.kind];
	const parts: Record<string, ReactNode> = {
		actor: event.actorName,
		audience: <span className="font-medium">{event.audienceName}</span>,
		campaign: (
			<Link
				to="/app/campaigns/$campaignId"
				params={{ campaignId: event.campaignId }}
				className="font-medium underline-offset-2 hover:underline"
			>
				{event.campaignName}
			</Link>
		),
	};
	// The template splits at each {name}. An odd index is a name, an even index is plain text.
	const sentence = t(
		linkCampaign ? `events.${event.kind}` : `eventsHere.${event.kind}`,
	)
		.split(/\{(\w+)\}/)
		.map((piece, index) =>
			index % 2 === 1 ? (
				// biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed template never reorder.
				<span key={index}>{parts[piece] ?? piece}</span>
			) : (
				piece
			),
		);

	return (
		<li className="flex gap-3">
			<span className="flex size-8 shrink-0 items-center justify-center rounded-control border bg-muted">
				<EventIcon className="size-4" />
			</span>
			{/* The time comes first: a sentence can wrap, and the time lines of the home columns still align. */}
			<div className="grid min-w-0 gap-0.5 text-sm">
				<p className="text-muted-foreground text-xs">
					<time dateTime={event.occurredAt}>
						{formatRelativeTime(event.occurredAt, now, locale)}
					</time>
					{` · ${dateTimeFormat(locale).format(new Date(event.occurredAt))}`}
				</p>
				<p>{sentence}</p>
			</div>
		</li>
	);
}
