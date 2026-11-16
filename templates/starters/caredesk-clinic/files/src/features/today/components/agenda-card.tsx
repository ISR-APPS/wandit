// The agenda of the home page: the appointments of today around the current time, with a now line.
// TodayPage renders it with the rows of today. A row opens the detail panel of the appointments page.
// The practitioner filter is local state. The rows and the now line come from lib/agenda.ts.
// The header holds the filter, so "See the whole day" sits in the footer, as a 44 px link for a finger.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	type AppointmentRow,
	AppointmentStatusBadge,
	fillMessage,
	isLate,
	PersonAvatar,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { ArrowRightIcon } from "~/shared/ui/icons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { AGENDA_ROW_LIMIT, buildAgendaWindow } from "../lib/agenda";

type AgendaCardProps = {
	/** The appointments of today with patient and practitioner, by start time. */
	rows: AppointmentRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
	/** The grid span of the home page. */
	className?: string;
};

// The Select value of "every practitioner". No practitioner has this id.
const ALL = "all";

/** A timeline of the day. Closed rows are muted, and the now line sits before the next row. */
export function AgendaCard({ rows, now, className }: AgendaCardProps) {
	const { t, locale } = useT();
	const [practitionerId, setPractitionerId] = useState(ALL);

	// Only a practitioner with an open slot today is a choice, so no choice gives an empty agenda.
	const practitioners = [
		...new Map(
			rows
				.filter((row) => row.status !== "cancelled")
				.map((row) => [row.practitioner.id, row.practitioner]),
		).values(),
	];
	// A cancelled appointment frees its slot, so the agenda leaves it out. The board and the list still show it.
	const dayRows = rows.filter(
		(row) =>
			row.status !== "cancelled" &&
			(practitionerId === ALL || row.practitioner.id === practitionerId),
	);
	const agenda = buildAgendaWindow(dayRows, now);
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const number = new Intl.NumberFormat(locale);

	return (
		// pb-2: the footer link is 44 px high for a finger, so the card needs less space under it.
		// A short day does not stretch the card to the height of the column beside it: no empty area.
		<Card
			className={cn(
				"pb-2",
				className,
				agenda.rows.length < AGENDA_ROW_LIMIT && "self-start",
			)}
		>
			<CardHeader>
				<CardTitle>{t("today.agenda")}</CardTitle>
				<CardDescription className="tabular-nums">
					{fillMessage(t("today.agendaCount"), {
						shown: number.format(agenda.rows.length),
						total: number.format(dayRows.length),
					})}
				</CardDescription>
				<CardAction>
					<Select value={practitionerId} onValueChange={setPractitionerId}>
						<SelectTrigger
							className="@xl/main:w-44 w-40 max-md:h-11"
							aria-label={t("today.agendaFilter")}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							<SelectItem value={ALL}>{t("today.allPractitioners")}</SelectItem>
							{practitioners.map((practitioner) => (
								<SelectItem key={practitioner.id} value={practitioner.id}>
									{practitioner.fullName}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="flex-1">
				{agenda.rows.length === 0 ? (
					<p className="py-10 text-center text-muted-foreground text-sm">
						{t("today.agendaEmpty")}
					</p>
				) : (
					<ol className="grid">
						{agenda.rows.map((row, index) => (
							<li key={row.id}>
								{index === agenda.nowIndex ? (
									<NowLine label={`${t("today.now")} ${time.format(now)}`} />
								) : null}
								<AgendaRow row={row} now={now} time={time} />
							</li>
						))}
						{agenda.nowIndex === agenda.rows.length ? (
							<li>
								<NowLine label={`${t("today.now")} ${time.format(now)}`} />
							</li>
						) : null}
					</ol>
				)}
			</CardContent>
			<CardFooter className="border-t pt-2">
				<Link
					to="/app/appointments"
					className="inline-flex min-h-11 items-center gap-1.5 font-medium text-sm hover:underline"
				>
					{t("today.seeAll")}
					<ArrowRightIcon className="size-4 rtl:rotate-180" />
				</Link>
			</CardFooter>
		</Card>
	);
}

type AgendaRowProps = {
	row: AppointmentRow;
	now: number;
	/** The short time format of the app language. */
	time: Intl.DateTimeFormat;
};

// One line of the agenda: the time, the patient, the visit, and the status. The whole line is a link.
function AgendaRow({ row, now, time }: AgendaRowProps) {
	const { t } = useT();
	// A closed row steps back, so the eye goes to the patients who are still to come.
	const isClosed = row.status === "completed" || row.status === "no_show";
	return (
		<Link
			to="/app/appointments"
			search={{ appointment: row.id }}
			className="-mx-2 flex min-h-13 items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
		>
			<span
				className={cn(
					"w-16 shrink-0 font-medium font-numeric text-sm tabular-nums",
					isClosed && "text-muted-foreground",
				)}
			>
				{time.format(row.startsAt)}
			</span>
			<PersonAvatar
				name={row.patient.fullName}
				className={cn("@xl/main:flex hidden", isClosed && "opacity-60")}
			/>
			<span className="grid min-w-0 flex-1">
				<span
					className={cn(
						"truncate font-medium text-sm",
						isClosed && "font-normal text-muted-foreground",
					)}
				>
					{row.patient.fullName}
				</span>
				<span className="truncate text-muted-foreground text-xs">
					{`${t(`visitTypes.${row.visitType}`)} · ${row.practitioner.fullName}`}
				</span>
			</span>
			<AppointmentStatusBadge status={row.status} isLate={isLate(row, now)} />
		</Link>
	);
}

// The rule between the past rows and the next row, with the current time.
function NowLine({ label }: { label: string }) {
	return (
		<div className="flex items-center gap-2 py-1.5">
			<span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground text-xs tabular-nums">
				{label}
			</span>
			<span className="h-px flex-1 bg-primary/40" />
		</div>
	);
}
