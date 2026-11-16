// The door of one event: the scanned tickets of the valid tickets, or the time until the doors open.
// EventDetailPage renders it in the rail. A cancelled event and an event not on sale yet show one muted line.
import {
	type EventSummary,
	fillMessage,
	formatRelativeTime,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

type DoorCardProps = {
	event: EventSummary;
	/** The time of the load, in milliseconds since 1970. */
	now: number;
};

/** After the doors open, the figure is the scan count. Before, it is the guests to expect, once tickets are on sale. */
export function DoorCard({ event, now }: DoorCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const isOpen = event.status === "live" || event.status === "completed";

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("events.door")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3">
				{event.status === "cancelled" ? (
					<p className="text-muted-foreground text-sm">
						{t("events.doorCancelled")}
					</p>
				) : event.status === "announced" ? (
					// No ticket is sold yet, so a figure of 0 tells nothing.
					<p className="text-muted-foreground text-sm">
						{fillMessage(t("events.doorAnnounced"), {
							when: formatRelativeTime(event.doorsAt, now, locale),
							date: shortDate.format(event.onSaleAt),
						})}
					</p>
				) : isOpen ? (
					<>
						<p className="font-numeric text-3xl tabular-nums">
							{number.format(event.checkedIn)}
							<span className="text-base text-muted-foreground">
								{` / ${number.format(event.sold)}`}
							</span>
						</p>
						<Progress
							value={event.checkedIn}
							max={event.sold}
							aria-label={t("events.door")}
						/>
						<p className="text-muted-foreground text-sm">
							{fillMessage(
								t(
									event.status === "live"
										? "events.doorLive"
										: "events.doorDone",
								),
								{
									rate: percent.format(
										event.sold === 0 ? 0 : event.checkedIn / event.sold,
									),
									missing: number.format(event.sold - event.checkedIn),
								},
							)}
						</p>
					</>
				) : (
					<>
						<p className="font-numeric text-3xl tabular-nums">
							{number.format(event.sold)}
						</p>
						<p className="text-muted-foreground text-sm">
							{fillMessage(t("events.doorAhead"), {
								when: formatRelativeTime(event.doorsAt, now, locale),
							})}
						</p>
					</>
				)}
			</CardContent>
		</Card>
	);
}
