// The leave calendar of the time-off page: a month or a week of approved and pending leave, one chip per person and day.
// TimeOffPage renders it first. A chip opens the request dialog; "+N more" opens the week of that day.
// It follows the kit calendar app: a toolbar (Today, arrows, month name, view, primary action) over a day grid.
// The month, the view, and the week are state of the card. They change no query.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import {
	addMonths,
	downloadCsv,
	fillMessage,
	monthGridDays,
	shiftDays,
	startOfWeek,
	TIME_OFF_TYPE_CHIP,
	TIME_OFF_TYPES,
	TimeOffTypeMark,
	toCsv,
	toDayKey,
	weekDays,
	workingDayKeys,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { CaretLeftIcon, CaretRightIcon } from "~/shared/ui/icons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import type { TimeOffRequest } from "../api/time-off.queries";
import { requestCsvColumns } from "../lib/request-csv";

// A month cell shows the first 3 people, then a "+N more" button, as the kit month view does.
const CHIPS_PER_DAY = 3;

/** The two views of the card. */
const VIEWS = ["month", "week"] as const;
type CalendarView = (typeof VIEWS)[number];

type LeaveCalendarCardProps = {
	/** Every request. The card keeps the approved and the pending ones. */
	requests: TimeOffRequest[];
	/** Local midnight of today, in milliseconds since 1970. */
	todayStart: number;
	/** Opens the request dialog of one request id. */
	onOpen: (requestId: string) => void;
};

/** A pending request has a dashed edge. Every chip names the person; its label also names the type and the status. */
export function LeaveCalendarCard({
	requests,
	todayStart,
	onOpen,
}: LeaveCalendarCardProps) {
	const { t, locale } = useT();
	const [view, setView] = useState<CalendarView>("month");
	// Any day of the shown period: the 1st of the month, or a day of the shown week.
	const [anchor, setAnchor] = useState(() => addMonths(todayStart, 0));
	const days =
		view === "month"
			? monthGridDays(addMonths(anchor, 0), locale)
			: weekDays(anchor, locale);
	const firstKey = toDayKey(new Date(days[0] ?? anchor));
	const lastKey = toDayKey(new Date(days.at(-1) ?? anchor));
	const shown = requests.filter(
		(request) =>
			(request.status === "approved" || request.status === "pending") &&
			request.startDate <= lastKey &&
			request.endDate >= firstKey,
	);
	// The requests of each working day of the grid, keyed by YYYY-MM-DD, the earliest first day first.
	const byDay = new Map<string, TimeOffRequest[]>();
	for (const request of shown) {
		for (const day of workingDayKeys(request.startDate, request.endDate)) {
			byDay.set(day, [...(byDay.get(day) ?? []), request]);
		}
	}
	const number = new Intl.NumberFormat(locale);
	const title =
		view === "month"
			? new Intl.DateTimeFormat(locale, {
					month: "long",
					year: "numeric",
				}).format(anchor)
			: new Intl.DateTimeFormat(locale, {
					day: "numeric",
					month: "short",
					year: "numeric",
				}).formatRange(days[0] ?? anchor, days.at(-1) ?? anchor);
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const month = new Date(anchor).getMonth();

	function move(step: -1 | 1) {
		setAnchor((current) =>
			view === "month"
				? addMonths(current, step)
				: shiftDays(current, 7 * step).getTime(),
		);
	}

	function changeView(next: CalendarView) {
		setView(next);
		// The week view opens on today when today is in the shown month, else on the 1st.
		setAnchor((current) =>
			next === "month"
				? addMonths(current, 0)
				: addMonths(todayStart, 0) === addMonths(current, 0)
					? startOfWeek(todayStart, locale)
					: startOfWeek(current, locale),
		);
	}

	function showWeekOf(dayStart: number) {
		setView("week");
		setAnchor(startOfWeek(dayStart, locale));
	}

	return (
		<Card className="gap-0 overflow-hidden py-0">
			<div className="flex flex-wrap items-center gap-2 p-4">
				<Button
					type="button"
					variant="outline"
					onClick={() =>
						setAnchor(
							view === "month"
								? addMonths(todayStart, 0)
								: startOfWeek(todayStart, locale),
						)
					}
				>
					{t("calendar.today")}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={t(
						view === "month"
							? "calendar.previousMonth"
							: "calendar.previousWeek",
					)}
					onClick={() => move(-1)}
				>
					<CaretLeftIcon className="rtl:rotate-180" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={t(
						view === "month" ? "calendar.nextMonth" : "calendar.nextWeek",
					)}
					onClick={() => move(1)}
				>
					<CaretRightIcon className="rtl:rotate-180" />
				</Button>
				<h2 className="ms-2 font-display font-semibold text-xl tabular-nums">
					{title}
				</h2>
				<div className="ms-auto flex items-center gap-2">
					<Select
						value={view}
						onValueChange={(value) => {
							const next = VIEWS.find((option) => option === value);
							if (next) {
								changeView(next);
							}
						}}
					>
						<SelectTrigger
							aria-label={t("calendar.view")}
							className="w-auto gap-2"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{VIEWS.map((option) => (
								<SelectItem key={option} value={option}>
									{t(`calendar.views.${option}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						type="button"
						aria-label={t("calendar.exportShown")}
						onClick={() =>
							downloadCsv(
								`time-off-${firstKey}.csv`,
								toCsv(shown, requestCsvColumns(t, locale)),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">
							{t("calendar.exportShown")}
						</span>
					</Button>
				</div>
			</div>
			<ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 text-muted-foreground text-xs">
				{TIME_OFF_TYPES.map((type) => (
					<li key={type}>
						<TimeOffTypeMark type={type} />
					</li>
				))}
				<li className="inline-flex items-center gap-2">
					<span
						aria-hidden="true"
						className="h-2.5 w-4 rounded-sm border border-muted-foreground border-dashed"
					/>
					{t("timeOffStatuses.pending")}
				</li>
			</ul>
			{/* The grid scrolls sideways inside the card on a phone, so the page never scrolls sideways. */}
			<div className="overflow-x-auto border-t">
				<div className="min-w-3xl">
					<div className="grid grid-cols-7 border-b">
						{days.slice(0, 7).map((dayStart) => (
							<div
								key={dayStart}
								className="py-3 text-center text-muted-foreground text-sm"
							>
								{view === "month"
									? weekday.format(dayStart)
									: `${weekday.format(dayStart)} ${new Date(dayStart).getDate()}`}
							</div>
						))}
					</div>
					<div className="grid grid-cols-7">
						{days.map((dayStart, index) => {
							const dayRequests = byDay.get(toDayKey(new Date(dayStart))) ?? [];
							const visible =
								view === "month"
									? dayRequests.slice(0, CHIPS_PER_DAY)
									: dayRequests;
							const hidden = dayRequests.length - visible.length;
							const isToday = dayStart === todayStart;
							return (
								<div
									key={dayStart}
									className={cn(
										"grid content-start gap-1 border-b p-2",
										view === "month" ? "min-h-32" : "min-h-96",
										// The last column has no end rule: the card edge closes the row.
										index % 7 !== 6 && "border-e",
										index >= days.length - 7 && "border-b-0",
									)}
								>
									{view === "month" ? (
										<span
											className={cn(
												"flex size-6 items-center justify-center rounded-full text-sm tabular-nums",
												isToday &&
													"bg-primary font-semibold text-primary-foreground",
												!isToday &&
													new Date(dayStart).getMonth() !== month &&
													"text-muted-foreground",
											)}
										>
											{new Date(dayStart).getDate()}
										</span>
									) : null}
									{visible.map((request) => (
										<button
											key={request.id}
											type="button"
											onClick={() => onOpen(request.id)}
											aria-label={`${request.employeeName}, ${t(`timeOffTypes.${request.type}`)}, ${t(`timeOffStatuses.${request.status}`)}`}
											className={cn(
												"truncate rounded-sm border-s px-1.5 py-0.5 text-start text-xs outline-none hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/50",
												TIME_OFF_TYPE_CHIP[request.type],
												request.status === "pending" &&
													"border border-dashed bg-transparent",
											)}
											dir="auto"
										>
											{request.employeeName}
										</button>
									))}
									{hidden > 0 ? (
										<button
											type="button"
											onClick={() => showWeekOf(dayStart)}
											className="justify-self-start rounded-sm px-1.5 text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
										>
											{fillMessage(t("calendar.more"), {
												count: number.format(hidden),
											})}
										</button>
									) : null}
									{view === "week" && dayRequests.length === 0 ? (
										<p className="px-1.5 text-muted-foreground text-xs">
											{t("calendar.nobodyAway")}
										</p>
									) : null}
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</Card>
	);
}
