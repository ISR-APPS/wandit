// The appointments of one patient, newest first, in the main column of the patient file.
// PatientDetailPage renders it. A time opens the detail panel of the appointments page.
// The first rows show at once. A button shows the rest of a long history.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	type AppointmentRow,
	AppointmentStatusBadge,
	fillMessage,
	isLate,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

type PatientVisitsCardProps = {
	/** Every appointment of the patient, newest first. */
	appointments: AppointmentRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
	/** The grid span of the detail page. */
	className?: string;
};

// A history longer than this shows a "show all" button, so the rail stays beside the first screen.
const FIRST_ROWS = 8;

/** The description counts the same rows that the table lists, by status. */
export function PatientVisitsCard({
	appointments,
	now,
	className,
}: PatientVisitsCardProps) {
	const { t, locale } = useT();
	const [showsAll, setShowsAll] = useState(false);
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const countOf = (status: AppointmentRow["status"]) =>
		appointments.filter((row) => row.status === status).length;
	const rows = showsAll ? appointments : appointments.slice(0, FIRST_ROWS);

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("patients.appointments")}</CardTitle>
				<CardDescription className="tabular-nums">
					{fillMessage(t("patients.appointmentsSummary"), {
						total: number.format(appointments.length),
						seen: number.format(countOf("completed")),
						noShows: number.format(countOf("no_show")),
						cancelled: number.format(countOf("cancelled")),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3">
				{appointments.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("patients.noAppointments")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("appointments.when")}</TableHead>
								{/* A phone has room for three columns. Status matters more than the practitioner. */}
								<TableHead className="@xl/main:table-cell hidden">
									{t("appointments.practitioner")}
								</TableHead>
								<TableHead>{t("appointments.visit")}</TableHead>
								<TableHead>{t("appointments.status")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell>
										<div className="grid justify-items-start">
											<Link
												to="/app/appointments"
												search={{ view: "list", appointment: row.id }}
												className="whitespace-nowrap font-medium tabular-nums hover:underline"
											>
												{date.format(row.startsAt)}
											</Link>
											<span className="text-muted-foreground text-xs tabular-nums">
												{time.format(row.startsAt)}
											</span>
										</div>
									</TableCell>
									<TableCell className="@xl/main:table-cell hidden whitespace-nowrap">
										{row.practitioner.fullName}
									</TableCell>
									<TableCell>
										<div className="grid">
											<span>{t(`visitTypes.${row.visitType}`)}</span>
											<span className="text-muted-foreground text-xs">
												{row.reason}
											</span>
										</div>
									</TableCell>
									<TableCell>
										<AppointmentStatusBadge
											status={row.status}
											isLate={isLate(row, now)}
										/>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
				{appointments.length > FIRST_ROWS ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="justify-self-start max-md:h-11"
						onClick={() => setShowsAll(!showsAll)}
					>
						{showsAll
							? t("patients.showFewer")
							: fillMessage(t("patients.showAll"), {
									count: number.format(appointments.length),
								})}
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}
