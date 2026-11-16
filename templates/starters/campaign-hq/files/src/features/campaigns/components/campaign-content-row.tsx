// One calendar item of a campaign as a list row: a date block, the title with its format, and the status.
// CampaignContentCard renders one row per item in its "Next" and "Published" lists.
import {
	ChannelMark,
	CONTENT_FORMAT_CHANNEL,
	ContentStatusBadge,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import type { CampaignContent } from "../api/campaigns.queries";

type CampaignContentRowProps = {
	item: CampaignContent;
};

/** A date block, the title with its format, time, and owner, then the status. */
export function CampaignContentRow({ item }: CampaignContentRowProps) {
	const { t, locale } = useT();
	const date = new Date(item.scheduledAt);
	const channel = CONTENT_FORMAT_CHANNEL[item.format];
	return (
		<li className="flex items-center gap-3 rounded-control border bg-background px-3 py-2">
			<span className="grid w-10 shrink-0 justify-items-center leading-tight">
				<span className="text-muted-foreground text-xs">
					{new Intl.DateTimeFormat(locale, { month: "short" }).format(date)}
				</span>
				<span className="font-numeric text-lg tabular-nums">
					{new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date)}
				</span>
			</span>
			<span className="grid min-w-0 flex-1">
				<span className="truncate font-medium text-sm">{item.title}</span>
				<span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground text-xs">
					<ChannelMark channel={channel} />
					<span className="truncate">
						{`${t(`contentFormats.${item.format}`)} · ${new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date)}`}
						{/* A phone row has no room for the owner. The calendar dialog of the item names the owner. */}
						<span className="max-sm:hidden">{` · ${item.ownerName}`}</span>
					</span>
				</span>
			</span>
			<ContentStatusBadge status={item.status} />
		</li>
	);
}
