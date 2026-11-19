// The agenda view of the viewings calendar: the days of the month that have viewings, each with its rows.
// ViewingsPage renders it inside the calendar card. A row opens the page of the home.
import { Link } from "@tanstack/react-router";
import {
	addressOf,
	PropertyTile,
	type ViewingRow,
	ViewingStatusBadge,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { addMonths, dateOfDay, monthStartOf } from "../lib/calendar";

type CalendarAgendaViewProps = {
	/** Any day of the month on screen, as a day number. */
	anchorDay: number;
	/** The viewings of each day number, by start time. */
	days: Map<number, ViewingRow[]>;
};

/** A month with no viewing shows one sentence. */
export function CalendarAgendaView({
	anchorDay,
	days,
}: CalendarAgendaViewProps) {
	const { t, locale } = useT();
	const first = monthStartOf(anchorDay);
	const last = addMonths(first, 1);
	const dayTitle = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const busyDays = [...days.keys()]
		.filter((day) => day >= first && day < last)
		.sort((a, b) => a - b);

	if (busyDays.length === 0) {
		return (
			<p className="px-6 py-16 text-center text-muted-foreground text-sm">
				{t("viewings.emptyMonth")}
			</p>
		);
	}
	return (
		<div className="grid divide-y">
			{busyDays.map((day) => (
				<section key={day} className="grid gap-2 px-4 py-3 md:px-6">
					<h3 className="font-medium text-sm">
						{dayTitle.format(dateOfDay(day))}
					</h3>
					<ul className="grid gap-1">
						{(days.get(day) ?? []).map((viewing) => (
							<li key={viewing.id}>
								<Link
									to="/app/listings/$listingId"
									params={{ listingId: viewing.listingId }}
									className="flex items-center gap-3 rounded-md p-2 hover:bg-muted"
								>
									<span className="w-14 shrink-0 text-muted-foreground text-sm tabular-nums">
										{time.format(new Date(viewing.startsAt))}
									</span>
									<PropertyTile type={viewing.listingType} className="size-8" />
									<span className="grid min-w-0 flex-1 gap-0.5">
										<span className="truncate font-medium text-sm" dir="auto">
											{addressOf({
												street: viewing.listingStreet,
												unit: viewing.listingUnit,
											})}
										</span>
										<span className="truncate text-muted-foreground text-xs">
											{`${viewing.leadName} · ${viewing.agentName}`}
										</span>
									</span>
									<ViewingStatusBadge status={viewing.status} />
								</Link>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
