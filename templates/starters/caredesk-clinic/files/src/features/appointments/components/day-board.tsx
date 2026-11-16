// The board of one day: one column per practitioner on duty, with the appointments by start time.
// AppointmentsPage renders it for the "day" view. The day is local state; the arrows move it inside the book.
// A card opens the detail panel through the `appointment` id of the URL.
// On a phone a Select shows one practitioner, so the front desk does not scroll past every column.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	type AppointmentRow,
	AppointmentStatusBadge,
	addDays,
	atMinute,
	BOOK_FUTURE_DAYS,
	BOOK_PAST_DAYS,
	fillMessage,
	isLate,
	listPractitioners,
	PersonAvatar,
	type Practitioner,
	rowsOfDay,
	shiftOn,
	startOfLocalDay,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { CaretLeftIcon, CaretRightIcon } from "~/shared/ui/icons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";

// The Select value of "every practitioner". No practitioner has this id.
const ALL = "all";

type DayBoardProps = {
	/** Every appointment of the book, oldest first. */
	rows: AppointmentRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
};

/**
 * The columns wrap to more lines on a narrow page, so the page never scrolls sideways. On a phone the day buttons are 44 px high.
 * Below the @xl container width, the practitioner Select hides the other columns. From @xl every column shows.
 */
export function DayBoard({ rows, now }: DayBoardProps) {
	const { t, locale } = useT();
	// Days from today: 0 is today, -1 is yesterday.
	const [dayOffset, setDayOffset] = useState(0);
	// The practitioner of the Select. An empty id means "no choice yet".
	const [focusId, setFocusId] = useState("");
	const dayStart = addDays(startOfLocalDay(now), dayOffset);
	const dayRows = rowsOfDay(rows, dayStart, addDays(dayStart, 1));
	// A cancelled slot is free again, so the header counts it apart. The home counts the day the same way.
	const cancelledCount = dayRows.filter(
		(row) => row.status === "cancelled",
	).length;
	const practitioners = listPractitioners();
	const onDuty = practitioners.filter(
		(practitioner) => shiftOn(practitioner, dayStart) !== null,
	);
	const offDuty = practitioners.filter(
		(practitioner) => shiftOn(practitioner, dayStart) === null,
	);
	// A phone starts on the first practitioner on duty, so the page is not a long stack of columns.
	// With no choice yet, or a choice off duty on the new day, the first practitioner on duty shows.
	const focused =
		focusId === ALL
			? undefined
			: (onDuty.find((practitioner) => practitioner.id === focusId) ??
				onDuty[0]);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const number = new Intl.NumberFormat(locale);
	const names = new Intl.ListFormat(locale, { type: "conjunction" });

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="grid gap-0.5">
					<h2 className="font-display font-semibold text-lg">
						{date.format(dayStart)}
					</h2>
					<p className="text-muted-foreground text-sm tabular-nums">
						{fillMessage(
							t(
								cancelledCount > 0
									? "appointments.dayCountWithCancelled"
									: "appointments.dayCount",
							),
							{
								count: number.format(dayRows.length - cancelledCount),
								cancelled: number.format(cancelledCount),
								practitioners: number.format(onDuty.length),
							},
						)}
					</p>
					{offDuty.length > 0 ? (
						<p className="text-muted-foreground text-sm">
							{`${t("appointments.offDuty")} ${names.format(
								offDuty.map((practitioner) => practitioner.fullName),
							)}`}
						</p>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="max-md:size-11"
						aria-label={t("appointments.previousDay")}
						// The book starts 90 days ago. An earlier day has no board.
						disabled={dayOffset <= -BOOK_PAST_DAYS}
						onClick={() => setDayOffset(dayOffset - 1)}
					>
						<CaretLeftIcon className="rtl:rotate-180" />
					</Button>
					<Button
						type="button"
						variant="outline"
						className="max-md:h-11"
						disabled={dayOffset === 0}
						onClick={() => setDayOffset(0)}
					>
						{t("appointments.today")}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="max-md:size-11"
						aria-label={t("appointments.nextDay")}
						// Patients book at most 14 days ahead.
						disabled={dayOffset >= BOOK_FUTURE_DAYS}
						onClick={() => setDayOffset(dayOffset + 1)}
					>
						<CaretRightIcon className="rtl:rotate-180" />
					</Button>
				</div>
			</div>
			<Select value={focused?.id ?? ALL} onValueChange={setFocusId}>
				<SelectTrigger
					className="@xl/main:hidden h-11 w-full"
					aria-label={t("appointments.practitionerFilter")}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent align="start">
					<SelectItem value={ALL}>
						{t("appointments.allPractitioners")}
					</SelectItem>
					{onDuty.map((practitioner) => (
						<SelectItem key={practitioner.id} value={practitioner.id}>
							{practitioner.fullName}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{/* auto-fit stretches the columns of a short day over the whole row. At most 5 work on one day: one row from 1280 px. */}
			<div className="grid grid-cols-[repeat(auto-fit,minmax(11.5rem,1fr))] items-start gap-3">
				{onDuty.map((practitioner) => (
					<PractitionerColumn
						key={practitioner.id}
						className={
							focused && focused.id !== practitioner.id
								? "@max-xl/main:hidden"
								: undefined
						}
						practitioner={practitioner}
						dayStart={dayStart}
						rows={dayRows.filter(
							(row) => row.practitioner.id === practitioner.id,
						)}
						now={now}
					/>
				))}
			</div>
		</div>
	);
}

type PractitionerColumnProps = {
	/** Hides the column on a phone when the Select shows another practitioner. */
	className: string | undefined;
	practitioner: Practitioner;
	/** Local midnight of the day of the board, in milliseconds since 1970. */
	dayStart: number;
	/** The appointments of the practitioner on that day, by start time. */
	rows: AppointmentRow[];
	now: number;
};

// One practitioner of the day: the name, the room, the shift, and the appointment cards.
function PractitionerColumn({
	className,
	practitioner,
	dayStart,
	rows,
	now,
}: PractitionerColumnProps) {
	const { t, locale } = useT();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const number = new Intl.NumberFormat(locale);
	const shift = shiftOn(practitioner, dayStart);
	return (
		<Card className={cn("gap-3 py-3", className)}>
			<div className="grid gap-2 px-3">
				<div className="flex items-center gap-2.5">
					<PersonAvatar name={practitioner.fullName} tone="staff" />
					<div className="grid min-w-0">
						<span className="truncate font-semibold text-sm">
							{practitioner.fullName}
						</span>
						<span className="truncate text-muted-foreground text-xs">
							{practitioner.room}
						</span>
					</div>
				</div>
				<div className="flex items-center justify-between gap-2 text-muted-foreground text-xs tabular-nums">
					<span className="truncate">
						{shift
							? time.formatRange(
									atMinute(dayStart, shift[0]),
									atMinute(dayStart, shift[1]),
								)
							: null}
					</span>
					{/* The count leaves out a cancelled card, as the header of the board does. */}
					<span className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-foreground">
						{number.format(
							rows.filter((row) => row.status !== "cancelled").length,
						)}
					</span>
				</div>
			</div>
			<CardContent className="px-3">
				{rows.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{t("appointments.noneForPractitioner")}
					</p>
				) : (
					<ol className="grid gap-2">
						{rows.map((row) => (
							<li key={row.id}>
								<AppointmentCard row={row} now={now} time={time} />
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}

type AppointmentCardProps = {
	row: AppointmentRow;
	now: number;
	/** The short time format of the app language. */
	time: Intl.DateTimeFormat;
};

// One appointment of a column. The patient with the practitioner now gets the accent tint.
function AppointmentCard({ row, now, time }: AppointmentCardProps) {
	const { t } = useT();
	const isClosed =
		row.status === "completed" ||
		row.status === "no_show" ||
		row.status === "cancelled";
	return (
		<Link
			to="/app/appointments"
			search={(previous) => ({ ...previous, appointment: row.id })}
			className={cn(
				"grid gap-1 rounded-md border bg-background px-2.5 py-2 hover:border-ring",
				row.status === "in_progress" && "border-primary/40 bg-primary/8",
				isClosed && "bg-muted/50",
			)}
		>
			{/* A narrow column puts a long status under the time, so the time never breaks. */}
			<span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
				<span
					className={cn(
						"whitespace-nowrap font-medium font-numeric text-xs tabular-nums",
						isClosed && "text-muted-foreground",
					)}
				>
					{time.format(row.startsAt)}
				</span>
				<AppointmentStatusBadge
					status={row.status}
					isLate={isLate(row, now)}
					className="px-1.5"
				/>
			</span>
			<span
				className={cn(
					"truncate font-medium text-sm",
					isClosed && "font-normal text-muted-foreground",
				)}
			>
				{row.patient.fullName}
			</span>
			<span className="truncate text-muted-foreground text-xs">
				{row.visitType === "first_visit"
					? t("visitTypes.first_visit")
					: row.reason}
			</span>
		</Link>
	);
}
