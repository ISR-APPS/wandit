// The summary strip of the Events page: all events of the period, the active people, the events per person, and the busiest day.
// EventsPage renders it above the catalog with the totals of the catalog query.
import { ChangePill, changeRatio, dayToDate } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import type { EventCatalog } from "../api/events.queries";

type EventSummaryStripProps = {
	/** The catalog of the chosen period. */
	catalog: EventCatalog;
};

/** One panel with four cells. The first cell is the sum of the volume column of the catalog. */
export function EventSummaryStrip({ catalog }: EventSummaryStripProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const perPerson = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
	const dayFormat = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const change = changeRatio(catalog.volume.current, catalog.volume.previous);

	return (
		<Card>
			<CardContent>
				<dl className="grid @3xl/main:grid-cols-4 grid-cols-2 gap-x-8 gap-y-6">
					<div className="grid content-start gap-1.5">
						<dt className="label-text text-muted-foreground text-sm">
							{t("events.summary.events")}
						</dt>
						<dd className="flex flex-wrap items-center gap-2">
							<span className="font-numeric font-semibold text-2xl tabular-nums leading-none">
								{number.format(catalog.volume.current)}
							</span>
							{change === null ? null : (
								<ChangePill change={change} goodWhen="up" />
							)}
						</dd>
					</div>
					<div className="grid content-start gap-1.5">
						<dt className="label-text text-muted-foreground text-sm">
							{t("events.summary.activePeople")}
						</dt>
						<dd className="font-numeric font-semibold text-2xl tabular-nums leading-none">
							{number.format(catalog.activePeople)}
						</dd>
					</div>
					<div className="grid content-start gap-1.5">
						<dt className="label-text text-muted-foreground text-sm">
							{t("events.summary.perPerson")}
						</dt>
						<dd className="font-numeric font-semibold text-2xl tabular-nums leading-none">
							{catalog.activePeople === 0
								? number.format(0)
								: perPerson.format(
										catalog.volume.current / catalog.activePeople,
									)}
						</dd>
					</div>
					<div className="grid content-start gap-1.5">
						<dt className="label-text text-muted-foreground text-sm">
							{t("events.summary.busiestDay")}
						</dt>
						<dd className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
							<span className="font-numeric font-semibold text-2xl tabular-nums leading-none">
								{number.format(catalog.busiestDay?.volume ?? 0)}
							</span>
							{catalog.busiestDay ? (
								<span className="text-muted-foreground text-sm">
									{dayFormat.format(dayToDate(catalog.busiestDay.day))}
								</span>
							) : null}
						</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}
