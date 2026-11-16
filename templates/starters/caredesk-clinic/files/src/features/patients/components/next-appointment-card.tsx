// The next appointment of one patient, in the rail of the patient file.
// PatientDetailPage renders it. The link opens the detail panel of the appointments page.
// With no booking, the panel keeps its place and says so.
import { Link } from "@tanstack/react-router";
import {
	type AppointmentRow,
	AppointmentStatusBadge,
	formatRelativeTime,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { ArrowRightIcon } from "~/shared/ui/icons";

type NextAppointmentCardProps = {
	/** The next appointment that is still expected, or null. */
	appointment: AppointmentRow | null;
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
};

/** The day stands in a calendar tile, so the date reads before the details. */
export function NextAppointmentCard({
	appointment,
	now,
}: NextAppointmentCardProps) {
	const { t, locale } = useT();
	const month = new Intl.DateTimeFormat(locale, { month: "short" });
	const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const weekdayTime = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		hour: "numeric",
		minute: "2-digit",
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("patients.nextAppointment")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				{appointment ? (
					<>
						<div className="flex items-center gap-4">
							<div className="grid w-16 shrink-0 justify-items-center rounded-lg bg-accent py-2 text-accent-foreground">
								<span className="font-medium text-xs">
									{month.format(appointment.startsAt)}
								</span>
								<span className="font-numeric font-semibold text-2xl tabular-nums leading-tight">
									{dayNumber.format(appointment.startsAt)}
								</span>
							</div>
							<div className="grid min-w-0 gap-1">
								<span className="font-medium tabular-nums">
									{weekdayTime.format(appointment.startsAt)}
								</span>
								<span className="text-muted-foreground text-sm">
									{formatRelativeTime(appointment.startsAt, now, locale)}
								</span>
							</div>
						</div>
						<dl className="grid gap-2 text-sm">
							<div className="flex justify-between gap-3">
								<dt className="text-muted-foreground">
									{t("appointments.practitioner")}
								</dt>
								<dd className="text-end font-medium">
									{appointment.practitioner.fullName}
								</dd>
							</div>
							<div className="flex justify-between gap-3">
								<dt className="text-muted-foreground">
									{t("appointments.visit")}
								</dt>
								<dd className="text-end font-medium">
									{`${t(`visitTypes.${appointment.visitType}`)} · ${appointment.room}`}
								</dd>
							</div>
							<div className="flex items-center justify-between gap-3">
								<dt className="text-muted-foreground">
									{t("appointments.status")}
								</dt>
								<dd>
									<AppointmentStatusBadge status={appointment.status} />
								</dd>
							</div>
						</dl>
						<Link
							to="/app/appointments"
							search={{ view: "list", appointment: appointment.id }}
							className="-my-2 inline-flex min-h-11 items-center gap-1.5 font-medium text-sm hover:underline"
						>
							{t("patients.openAppointment")}
							<ArrowRightIcon className="size-4 rtl:rotate-180" />
						</Link>
					</>
				) : (
					<p className="text-muted-foreground text-sm">
						{t("patients.noneBookedLong")}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
