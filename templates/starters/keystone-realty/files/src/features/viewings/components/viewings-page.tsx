// The viewings page: one calendar card with a toolbar (today, previous, next, the period name,
// the view menu, and the CSV export), then the month, week, or agenda view of the viewings.
// The /app/viewings route renders it after its loader. The route also uses the skeleton and the error below.
// The view and the day on screen are state of this page. They change no query: the rows are all loaded.
import { CaretDownIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	addressOf,
	dayNumberOf,
	downloadCsv,
	toCsv,
	VIEWING_STATUSES,
	type ViewingRow,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import { CaretLeftIcon, CaretRightIcon, CheckIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { viewingsQueryOptions } from "../api/viewings.queries";
import {
	addMonths,
	dateOfDay,
	monthGridRange,
	monthStartOf,
	viewingsByDay,
	WEEK_DAYS,
	weekStartDayOf,
	weekStartOf,
} from "../lib/calendar";
import { CalendarAgendaView } from "./calendar-agenda-view";
import { CalendarMonthView } from "./calendar-month-view";
import { CalendarWeekView } from "./calendar-week-view";
import { VIEWING_CHIP_TINT } from "./viewing-chip";

const CALENDAR_VIEWS = ["month", "week", "agenda"] as const;

/** One view of the calendar. The label is the message `viewings.views.<view>`. */
type CalendarView = (typeof CALENDAR_VIEWS)[number];

/** The calendar of every viewing. It opens on the month of today. */
export function ViewingsPage() {
	const { t, locale } = useT();
	const { data: viewings } = useSuspenseQuery(viewingsQueryOptions());
	const today = dayNumberOf(Date.now());
	const [view, setView] = useState<CalendarView>("month");
	const [anchorDay, setAnchorDay] = useState(today);
	const weekStart = weekStartOf(locale);
	const days = viewingsByDay(viewings);

	// The days on screen: the weeks of the month grid, the 7 days of the week, or the month of the agenda.
	const monthStart = monthStartOf(anchorDay);
	const weekFirst = weekStartDayOf(anchorDay, weekStart);
	const range: [number, number] =
		view === "week"
			? [weekFirst, weekFirst + WEEK_DAYS]
			: view === "month"
				? monthGridRange(anchorDay, weekStart)
				: [monthStart, addMonths(monthStart, 1)];
	const shownViewings = viewings.filter((viewing) => {
		const day = dayNumberOf(Date.parse(viewing.startsAt));
		return day >= range[0] && day < range[1];
	});

	const title =
		view === "week"
			? new Intl.DateTimeFormat(locale, {
					day: "numeric",
					month: "short",
					year: "numeric",
				}).formatRange(dateOfDay(range[0]), dateOfDay(range[1] - 1))
			: new Intl.DateTimeFormat(locale, {
					month: "long",
					year: "numeric",
				}).format(dateOfDay(monthStart));

	function move(step: -1 | 1) {
		setAnchorDay((day) =>
			view === "week" ? day + step * WEEK_DAYS : addMonths(day, step),
		);
	}

	function exportShown() {
		const dateTime = new Intl.DateTimeFormat(locale, {
			dateStyle: "medium",
			timeStyle: "short",
		});
		downloadCsv(
			"viewings.csv",
			toCsv<ViewingRow>(shownViewings, [
				{
					header: t("viewings.when"),
					value: (row) => dateTime.format(new Date(row.startsAt)),
				},
				{
					header: t("viewings.home"),
					value: (row) =>
						addressOf({ street: row.listingStreet, unit: row.listingUnit }),
				},
				{ header: t("viewings.lead"), value: (row) => row.leadName },
				{ header: t("viewings.agent"), value: (row) => row.agentName },
				{
					header: t("viewings.status"),
					value: (row) => t(`agency.viewingStatuses.${row.status}`),
				},
			]),
		);
	}

	return (
		<div className="grid gap-4">
			<h1 className="sr-only">{t("viewings.title")}</h1>
			<Card className="gap-0 overflow-hidden py-0">
				<div className="flex flex-wrap items-center justify-between gap-2 p-4">
					<div className="flex items-center gap-1 sm:gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={() => setAnchorDay(today)}
						>
							{t("viewings.today")}
						</Button>
						<div className="flex items-center">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label={t("viewings.previous")}
								onClick={() => move(-1)}
							>
								<CaretLeftIcon className="rtl:rotate-180" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label={t("viewings.next")}
								onClick={() => move(1)}
							>
								<CaretRightIcon className="rtl:rotate-180" />
							</Button>
						</div>
						<h2 className="font-display font-semibold text-base sm:text-xl">
							{title}
						</h2>
					</div>
					<div className="flex items-center gap-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button type="button" variant="outline">
									{t(`viewings.views.${view}`)}
									<CaretDownIcon className="opacity-60" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-36">
								{CALENDAR_VIEWS.map((option) => (
									<DropdownMenuItem
										key={option}
										role="menuitemradio"
										aria-checked={option === view}
										onSelect={() => setView(option)}
									>
										<CheckIcon
											className={cn(
												"size-4",
												option === view ? "" : "invisible",
											)}
										/>
										{t(`viewings.views.${option}`)}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
						<Button
							type="button"
							aria-label={t("common.exportCsv")}
							onClick={exportShown}
						>
							<DownloadSimpleIcon />
							<span className="hidden sm:inline">{t("common.exportCsv")}</span>
						</Button>
					</div>
				</div>
				<div className="border-t">
					{view === "month" ? (
						<CalendarMonthView
							anchorDay={anchorDay}
							today={today}
							weekStart={weekStart}
							days={days}
						/>
					) : view === "week" ? (
						<CalendarWeekView
							anchorDay={anchorDay}
							today={today}
							weekStart={weekStart}
							days={days}
						/>
					) : (
						<CalendarAgendaView anchorDay={anchorDay} days={days} />
					)}
				</div>
				{view === "agenda" ? null : (
					<ul className="flex flex-wrap gap-x-4 gap-y-2 border-t px-4 py-3 text-muted-foreground text-xs">
						{VIEWING_STATUSES.map((status) => (
							<li key={status} className="flex items-center gap-1.5">
								<span
									aria-hidden="true"
									className={cn(
										"size-3 rounded-sm no-underline",
										VIEWING_CHIP_TINT[status],
									)}
								/>
								{t(`agency.viewingStatuses.${status}`)}
							</li>
						))}
					</ul>
				)}
			</Card>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function ViewingsPageSkeleton() {
	return <Skeleton className="h-200 rounded-surface" />;
}

/** Error state when the loader fails. Try again runs the loader again. */
export function ViewingsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("viewings.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
