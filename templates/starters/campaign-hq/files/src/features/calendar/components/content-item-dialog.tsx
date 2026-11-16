// The dialog of one calendar item: its status, campaign, channel, format, time, and owner.
// CalendarPage opens it from a chip of the grid, the agenda, the day dialog, or the "Up next" list.
import { Link } from "@tanstack/react-router";
import {
	ChannelMark,
	ContentStatusBadge,
	formatRelativeTime,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import type { ContentItem } from "../api/calendar.queries";

type ContentItemDialogProps = {
	/** The item to show. It stays set while the dialog closes, so the content does not empty during the fade. */
	item: ContentItem | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A controlled dialog with one `dl` of facts and a link to the campaign page. */
export function ContentItemDialog({
	item,
	open,
	onOpenChange,
}: ContentItemDialogProps) {
	const { t, locale } = useT();
	const when = new Intl.DateTimeFormat(locale, {
		dateStyle: "full",
		timeStyle: "short",
	});
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				{item ? (
					<>
						<DialogHeader>
							<DialogTitle dir="auto">{item.title}</DialogTitle>
							<DialogDescription dir="auto">
								{`${item.campaignName} · ${item.client}`}
							</DialogDescription>
						</DialogHeader>
						<dl className="grid grid-cols-2 gap-4 text-sm">
							<div className="grid gap-1">
								<dt className="text-muted-foreground">
									{t("calendar.status")}
								</dt>
								<dd>
									<ContentStatusBadge status={item.status} />
								</dd>
							</div>
							<div className="grid gap-1">
								<dt className="text-muted-foreground">
									{t("calendar.channel")}
								</dt>
								<dd className="flex items-center gap-2">
									<ChannelMark channel={item.channel} />
									{t(`channels.${item.channel}`)}
								</dd>
							</div>
							<div className="grid gap-1">
								<dt className="text-muted-foreground">
									{t("calendar.format")}
								</dt>
								<dd>{t(`contentFormats.${item.format}`)}</dd>
							</div>
							<div className="grid gap-1">
								<dt className="text-muted-foreground">{t("calendar.owner")}</dt>
								<dd>{item.ownerName}</dd>
							</div>
							<div className="col-span-2 grid gap-1">
								<dt className="text-muted-foreground">{t("calendar.when")}</dt>
								<dd>
									{when.format(new Date(item.scheduledAt))}
									<span className="text-muted-foreground">
										{` · ${formatRelativeTime(item.scheduledAt, Date.now(), locale)}`}
									</span>
								</dd>
							</div>
						</dl>
						<DialogFooter>
							<Button asChild variant="outline">
								<Link
									to="/app/campaigns/$campaignId"
									params={{ campaignId: item.campaignId }}
								>
									{t("calendar.openCampaign")}
								</Link>
							</Button>
						</DialogFooter>
					</>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
