// The rail of the calendar: the count of items per status and per channel in the shown month, and the next items.
// CalendarPage renders it beside the month on a very wide page (80rem), and under it on other pages.
import {
	CHANNELS,
	ChannelMark,
	CONTENT_STATUSES,
	ContentStatusBadge,
	fillMessage,
	formatRelativeTime,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { ContentItem } from "../api/calendar.queries";
import { ContentChip } from "./content-chip";

type CalendarRailProps = {
	/** The items of the shown month after the filters. The status counts read them. */
	monthItems: ContentItem[];
	/** The next items to go out after the filters, oldest first, at most a few. */
	nextItems: ContentItem[];
	/** The time of the render, in milliseconds since 1970. */
	now: number;
	onOpenItem: (itemId: string) => void;
};

/** Two panels. The status counts and the channel counts each add up to the item count of the month. */
export function CalendarRail({
	monthItems,
	nextItems,
	now,
	onOpenItem,
}: CalendarRailProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<div className="grid @3xl/main:grid-cols-2 @7xl/main:grid-cols-1 content-start gap-6">
			<Card className="gap-4">
				<CardHeader>
					<CardTitle>{t("calendar.pipeline")}</CardTitle>
					<CardDescription>
						{fillMessage(
							t(
								monthItems.length === 1
									? "calendar.pipelineHintOne"
									: "calendar.pipelineHint",
							),
							{
								count: number.format(monthItems.length),
							},
						)}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ul className="grid gap-3">
						{CONTENT_STATUSES.map((status) => {
							const count = monthItems.filter(
								(item) => item.status === status,
							).length;
							return (
								<li key={status} className="grid gap-1.5">
									<span className="flex items-center justify-between gap-2">
										<ContentStatusBadge status={status} />
										<span className="font-numeric tabular-nums">
											{number.format(count)}
										</span>
									</span>
									<Progress
										value={count}
										max={monthItems.length}
										aria-label={t(`contentStatus.${status}`)}
										className="h-1.5"
									/>
								</li>
							);
						})}
					</ul>
					<section className="mt-5 grid gap-2 border-t pt-4">
						<h3 className="label-text text-muted-foreground text-xs">
							{t("calendar.byChannel")}
						</h3>
						<ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
							{CHANNELS.map((channel) => (
								<li key={channel} className="flex items-center gap-1.5">
									<ChannelMark channel={channel} />
									{t(`channels.${channel}`)}
									<span className="font-numeric text-muted-foreground tabular-nums">
										{number.format(
											monthItems.filter((item) => item.channel === channel)
												.length,
										)}
									</span>
								</li>
							))}
						</ul>
					</section>
				</CardContent>
			</Card>
			<Card className="gap-4">
				<CardHeader>
					<CardTitle>{t("calendar.upNext")}</CardTitle>
				</CardHeader>
				<CardContent>
					{nextItems.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("calendar.upNextEmpty")}
						</p>
					) : (
						<ul className="grid gap-3">
							{nextItems.map((item) => (
								<li key={item.id} className="grid gap-1">
									<span className="text-muted-foreground text-xs">
										{`${item.campaignName} · ${formatRelativeTime(item.scheduledAt, now, locale)}`}
									</span>
									<ContentChip item={item} onOpen={onOpenItem} />
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
