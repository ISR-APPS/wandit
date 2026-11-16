// The agenda of the viewings page: a strip of 7 days and the viewings of the day that the user picks.
// ViewingsPage renders it with the rows of the viewings query. The week buttons move the strip by 7 days.
// The first week starts today. Each viewing opens the detail page of its listing.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	addressOf,
	countLabel,
	dayNumberOf,
	fillMessage,
	InterestBadge,
	PropertyTile,
	timeOnDay,
	VIEWING_MINUTES,
	type ViewingRow,
	ViewingStatusBadge,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretLeftIcon, CaretRightIcon } from "~/shared/ui/icons";
import { AGENDA_DAYS, buildAgendaWeek } from "../lib/agenda";

// The agenda goes 8 weeks back and 2 weeks forward. The sample viewings lie in that range.
const FIRST_WEEK = -8;
const LAST_WEEK = 2;

type AgendaCardProps = {
	/** Every viewing, by start time, as the viewings query returns them. */
	viewings: ViewingRow[];
};

/** The picked day is view state. A new week picks today, or its first day with a viewing. */
export function AgendaCard({ viewings }: AgendaCardProps) {
	const { t, locale } = useT();
	const today = dayNumberOf(Date.now());
	const [week, setWeek] = useState(0);
	const [pickedDay, setPickedDay] = useState<number | null>(null);

	const days = buildAgendaWeek(viewings, today + week * AGENDA_DAYS);
	const firstBusyDay = days.find((day) => day.viewings.length > 0);
	const shownDay =
		days.find((day) => day.dayNumber === pickedDay) ??
		(week === 0 ? days[0] : (firstBusyDay ?? days[0]));
	const dateOf = (dayNumber: number) => new Date(timeOnDay(dayNumber, 0));
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayOfMonth = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const longDay = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const range = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const clock = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const minutes = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "minute",
		unitDisplay: "short",
	});
	const viewingCount = (count: number) =>
		countLabel(count, t("viewings.countOne"), t("viewings.countOther"), locale);
	const changeWeek = (next: number) => {
		setWeek(next);
		setPickedDay(null);
	};
	const firstDay = days[0];
	const lastDay = days.at(-1);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("viewings.agendaTitle")}</CardTitle>
				<CardDescription className="tabular-nums">
					{firstDay && lastDay
						? range.formatRange(
								dateOf(firstDay.dayNumber),
								dateOf(lastDay.dayNumber),
							)
						: null}
				</CardDescription>
				<CardAction className="flex items-center gap-1">
					{week === 0 ? null : (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="max-sm:h-11"
							onClick={() => changeWeek(0)}
						>
							{t("viewings.thisWeek")}
						</Button>
					)}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="max-sm:size-11"
						aria-label={t("viewings.previousWeek")}
						disabled={week === FIRST_WEEK}
						onClick={() => changeWeek(week - 1)}
					>
						<CaretLeftIcon className="rtl:rotate-180" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="max-sm:size-11"
						aria-label={t("viewings.nextWeek")}
						disabled={week === LAST_WEEK}
						onClick={() => changeWeek(week + 1)}
					>
						<CaretRightIcon className="rtl:rotate-180" />
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-5">
				{/* On a phone the strip scrolls sideways inside the panel, so each day keeps a touch width of 44 px. */}
				{/* 5.5 days show at once and the end fades, so the half day tells the user that the strip scrolls. */}
				<div className="-mx-1 flex gap-1.5 overflow-x-auto p-1 max-sm:pe-12 max-sm:[mask-image:linear-gradient(to_right,var(--foreground)_85%,transparent)] max-sm:rtl:[mask-image:linear-gradient(to_left,var(--foreground)_85%,transparent)]">
					{days.map((day) => {
						const isPicked = day.dayNumber === shownDay?.dayNumber;
						return (
							<button
								key={day.dayNumber}
								type="button"
								aria-pressed={isPicked}
								aria-label={`${longDay.format(dateOf(day.dayNumber))}, ${viewingCount(day.viewings.length)}`}
								onClick={() => setPickedDay(day.dayNumber)}
								className="grid min-w-11 flex-1 justify-items-center gap-1 rounded-md border px-1 py-2.5 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-primary/10 max-sm:shrink-0 max-sm:basis-[calc((100%-1.875rem)/5.5)]"
							>
								<span className="text-muted-foreground text-xs">
									{day.dayNumber === today
										? t("viewings.today")
										: weekday.format(dateOf(day.dayNumber))}
								</span>
								<span className="font-numeric text-xl tabular-nums leading-none">
									{dayOfMonth.format(dateOf(day.dayNumber))}
								</span>
								<span
									className={
										day.viewings.length === 0
											? "text-muted-foreground text-xs tabular-nums"
											: "rounded-full bg-secondary px-1.5 font-medium text-secondary-foreground text-xs tabular-nums"
									}
								>
									{new Intl.NumberFormat(locale).format(day.viewings.length)}
								</span>
							</button>
						);
					})}
				</div>
				{shownDay ? (
					<div className="grid gap-1">
						<p className="font-medium text-sm">
							{`${longDay.format(dateOf(shownDay.dayNumber))} · ${viewingCount(shownDay.viewings.length)}`}
						</p>
						{shownDay.viewings.length === 0 ? (
							<p className="py-6 text-muted-foreground text-sm">
								{t("viewings.emptyDay")}
							</p>
						) : (
							<ul className="grid">
								{/* Each row is its own grid. The badge column has a fixed width, so the columns line up between rows. */}
								{shownDay.viewings.map((viewing) => (
									<li
										key={viewing.id}
										className="grid @2xl/main:grid-cols-[5rem_minmax(0,1.3fr)_minmax(0,1fr)_11rem] grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b py-3 last:border-0 last:pb-0"
									>
										<div className="grid gap-0.5">
											<span className="font-numeric text-base tabular-nums leading-none">
												{clock.format(new Date(viewing.startsAt))}
											</span>
											<span className="text-muted-foreground text-xs">
												{minutes.format(VIEWING_MINUTES)}
											</span>
										</div>
										<div className="flex min-w-0 items-center gap-3">
											<PropertyTile type={viewing.listingType} />
											<div className="grid min-w-0 justify-items-start">
												<Link
													to="/app/listings/$listingId"
													params={{ listingId: viewing.listingId }}
													className="line-clamp-2 max-w-full font-medium text-sm hover:underline"
												>
													{addressOf({
														street: viewing.listingStreet,
														unit: viewing.listingUnit,
													})}
												</Link>
												<span className="text-muted-foreground text-xs">
													{viewing.neighborhood}
												</span>
											</div>
										</div>
										<div className="@2xl/main:col-start-auto col-start-2 grid min-w-0 text-sm">
											<span className="truncate" dir="auto">
												{viewing.leadName}
												{viewing.visitNumber > 1 ? (
													<span className="text-muted-foreground">
														{` · ${t("viewings.secondVisit")}`}
													</span>
												) : null}
											</span>
											<span className="truncate text-muted-foreground text-xs">
												{fillMessage(t("viewings.withAgent"), {
													agent: viewing.agentName,
												})}
											</span>
										</div>
										<div className="@2xl/main:col-start-auto col-start-2 flex items-center @2xl/main:justify-end gap-1.5">
											<ViewingStatusBadge status={viewing.status} />
											{viewing.interest === null ? null : (
												<InterestBadge interest={viewing.interest} />
											)}
										</div>
									</li>
								))}
							</ul>
						)}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
