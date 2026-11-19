// The two grids of the appointments calendar: a month of 4 to 6 weeks with 3 chips per day, and one week with every chip.
// AppointmentsPage renders one of them under its toolbar. Both read the rows that the page filtered.
// The grids scroll sideways inside the card on a phone, so the page never scrolls sideways.
import {
	type AppointmentRow,
	fillMessage,
	monthGridDays,
	startOfLocalDay,
	toIsoDay,
	weekDays,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { EventChip } from "./event-chip";

// A month cell shows the first 3 appointments, then a "+N more" button, as the kit month view does.
const CHIPS_PER_DAY = 3;

/** The rows of each local day, keyed by `YYYY-MM-DD`, in start order. */
function rowsByDay(
	rows: readonly AppointmentRow[],
): Map<string, AppointmentRow[]> {
	const byDay = new Map<string, AppointmentRow[]>();
	for (const row of rows) {
		const day = toIsoDay(row.startsAt);
		const list = byDay.get(day);
		if (list) {
			list.push(row);
		} else {
			byDay.set(day, [row]);
		}
	}
	return byDay;
}

type DayNumberProps = {
	dayStart: number;
	isToday: boolean;
	isMuted: boolean;
};

// The number of the day. Today is a filled circle, as in the kit.
function DayNumber({ dayStart, isToday, isMuted }: DayNumberProps) {
	return (
		<span
			className={cn(
				"flex size-6 items-center justify-center rounded-full text-sm tabular-nums",
				isToday && "bg-primary font-semibold text-primary-foreground",
				!isToday && isMuted && "text-muted-foreground",
			)}
		>
			{new Date(dayStart).getDate()}
		</span>
	);
}

type WeekdayHeadProps = {
	/** The 7 days of one row, local midnights. */
	days: number[];
	/** True adds the day number under the weekday name (week view). */
	showDate: boolean;
	now: number;
};

// The weekday names over the grid, in the order of the locale.
function WeekdayHead({ days, showDate, now }: WeekdayHeadProps) {
	const { locale } = useT();
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const todayStart = startOfLocalDay(now);
	return (
		<div className="grid grid-cols-7 border-b">
			{days.map((dayStart) => (
				<div
					key={dayStart}
					className="flex items-center justify-center gap-1.5 py-3 text-muted-foreground text-sm"
				>
					{weekday.format(dayStart)}
					{showDate ? (
						<DayNumber
							dayStart={dayStart}
							isToday={dayStart === todayStart}
							isMuted={false}
						/>
					) : null}
				</div>
			))}
		</div>
	);
}

type MonthGridProps = {
	/** Local midnight of the first day of the month. */
	monthStart: number;
	rows: readonly AppointmentRow[];
	now: number;
	onOpen: (appointmentId: string) => void;
	/** Opens the week view on the day of a "+N more" click. */
	onShowDay: (dayStart: number) => void;
};

/** One row per week of the month. A day outside the month keeps its chips, with a muted number. */
export function MonthGrid({
	monthStart,
	rows,
	now,
	onOpen,
	onShowDay,
}: MonthGridProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const days = monthGridDays(monthStart, locale);
	const byDay = rowsByDay(rows);
	const todayStart = startOfLocalDay(now);
	const month = new Date(monthStart).getMonth();
	return (
		<div className="overflow-x-auto">
			<div className="min-w-3xl">
				<WeekdayHead days={days.slice(0, 7)} showDate={false} now={now} />
				<div className="grid grid-cols-7">
					{days.map((dayStart, index) => {
						const dayRows = byDay.get(toIsoDay(dayStart)) ?? [];
						const hidden = dayRows.length - CHIPS_PER_DAY;
						return (
							<div
								key={dayStart}
								className={cn(
									"grid min-h-36 content-start gap-1 border-b p-2",
									// The last column has no end rule: the card edge closes the row.
									index % 7 !== 6 && "border-e",
									index >= 35 && "border-b-0",
								)}
							>
								<DayNumber
									dayStart={dayStart}
									isToday={dayStart === todayStart}
									isMuted={new Date(dayStart).getMonth() !== month}
								/>
								{dayRows.slice(0, CHIPS_PER_DAY).map((row) => (
									<EventChip key={row.id} row={row} onOpen={onOpen} />
								))}
								{hidden > 0 ? (
									<button
										type="button"
										onClick={() => onShowDay(dayStart)}
										className="justify-self-start rounded-sm px-1.5 text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
									>
										{fillMessage(t("appointments.more"), {
											count: number.format(hidden),
										})}
									</button>
								) : null}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

type WeekGridProps = {
	/** Any time inside the week to show. */
	anchor: number;
	rows: readonly AppointmentRow[];
	now: number;
	onOpen: (appointmentId: string) => void;
};

/** 7 columns with every appointment of each day, in start order. */
export function WeekGrid({ anchor, rows, now, onOpen }: WeekGridProps) {
	const { t, locale } = useT();
	const days = weekDays(anchor, locale);
	const byDay = rowsByDay(rows);
	return (
		<div className="overflow-x-auto">
			<div className="min-w-3xl">
				<WeekdayHead days={days} showDate now={now} />
				<div className="grid grid-cols-7">
					{days.map((dayStart, index) => {
						const dayRows = byDay.get(toIsoDay(dayStart)) ?? [];
						return (
							<div
								key={dayStart}
								className={cn(
									"grid min-h-96 content-start gap-1 p-2",
									index !== 6 && "border-e",
								)}
							>
								{dayRows.length === 0 ? (
									<p className="px-1.5 text-muted-foreground text-xs">
										{t("appointments.noneThisDay")}
									</p>
								) : (
									dayRows.map((row) => (
										<EventChip key={row.id} row={row} onOpen={onOpen} />
									))
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
