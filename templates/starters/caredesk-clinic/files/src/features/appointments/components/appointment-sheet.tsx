// The detail panel of one appointment: the patient, the visit, and the steps that happened.
// AppointmentsPage opens it for the `appointment` id of the URL. A close removes the id from the URL.
// It shows no step that is still in the future. Its only actions are real links: the patient file and a phone call.
import { PhoneIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
	type AppointmentRow,
	AppointmentStatusBadge,
	fillMessage,
	isLate,
	MINUTE_MS,
	PersonAvatar,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import { buildTimeline } from "../lib/appointment-views";

type AppointmentSheetProps = {
	/** The appointment to show, or null when the URL names no appointment or an unknown one. */
	row: AppointmentRow | null;
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
	/** Called when the user closes the panel. The page removes the id from the URL. */
	onClose: () => void;
};

/** A side panel on a desktop, a wide panel on a phone. Radix keeps the focus inside while it is open. */
export function AppointmentSheet({ row, now, onClose }: AppointmentSheetProps) {
	const { t, locale } = useT();
	// The panel keeps the last row while it slides out, so it never closes empty.
	const [shownRow, setShownRow] = useState(row);
	if (row !== null && row !== shownRow) {
		setShownRow(row);
	}
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const minutes = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "minute",
		unitDisplay: "short",
		maximumFractionDigits: 0,
	});

	return (
		<Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{shownRow ? (
					<>
						<SheetHeader className="gap-3 border-b pe-12">
							<div className="flex items-center gap-3">
								<PersonAvatar
									name={shownRow.patient.fullName}
									className="size-11"
								/>
								<div className="grid min-w-0 gap-0.5">
									<SheetTitle className="truncate font-display text-lg">
										{shownRow.patient.fullName}
									</SheetTitle>
									<SheetDescription className="tabular-nums">
										{`${shownRow.patient.fileNumber} · ${shownRow.patient.phone}`}
									</SheetDescription>
								</div>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<AppointmentStatusBadge
									status={shownRow.status}
									isLate={isLate(shownRow, now)}
								/>
								<span className="text-sm tabular-nums">
									{`${date.format(shownRow.startsAt)}, ${time.formatRange(
										shownRow.startsAt,
										shownRow.startsAt + shownRow.durationMinutes * MINUTE_MS,
									)}`}
								</span>
							</div>
						</SheetHeader>
						<div className="grid gap-6 p-4">
							<dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
								<Fact label={t("appointments.practitioner")}>
									{shownRow.practitioner.fullName}
								</Fact>
								<Fact label={t("appointments.room")}>{shownRow.room}</Fact>
								<Fact label={t("appointments.visit")}>
									{t(`visitTypes.${shownRow.visitType}`)}
								</Fact>
								<Fact label={t("appointments.length")}>
									<span className="tabular-nums">
										{minutes.format(shownRow.durationMinutes)}
									</span>
								</Fact>
								<Fact label={t("appointments.reason")} className="col-span-2">
									{shownRow.reason}
								</Fact>
								{shownRow.checkedInAt !== null &&
								shownRow.startedAt !== null ? (
									<Fact label={t("appointments.waited")} className="col-span-2">
										<span className="tabular-nums">
											{minutes.format(
												Math.round(
													(shownRow.startedAt - shownRow.checkedInAt) /
														MINUTE_MS,
												),
											)}
										</span>
									</Fact>
								) : null}
							</dl>
							<section className="grid gap-3">
								<h3 className="font-semibold text-sm">
									{t("appointments.timeline")}
								</h3>
								<ol className="grid">
									{buildTimeline(shownRow).map((event, index, events) => (
										<li key={event.step} className="flex gap-3">
											<span className="flex flex-col items-center">
												<span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
												{index < events.length - 1 ? (
													<span className="w-px flex-1 bg-border" />
												) : null}
											</span>
											<span className="grid gap-0.5 pb-4 text-sm">
												<span className="font-medium">
													{t(`timeline.${event.step}`)}
												</span>
												<span className="text-muted-foreground text-xs tabular-nums">
													{dateTime.format(event.at)}
												</span>
											</span>
										</li>
									))}
								</ol>
							</section>
						</div>
						<SheetFooter className="border-t sm:flex-row">
							<Button asChild className="flex-1">
								<Link
									to="/app/patients/$patientId"
									params={{ patientId: shownRow.patient.id }}
								>
									{t("appointments.openFile")}
								</Link>
							</Button>
							<Button asChild variant="outline" className="flex-1">
								<a
									href={`tel:${shownRow.patient.phone.replace(/[^\d+]/g, "")}`}
								>
									<PhoneIcon />
									{fillMessage(t("appointments.call"), {
										name: shownRow.patient.firstName,
									})}
								</a>
							</Button>
						</SheetFooter>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}

type FactProps = {
	/** The translated name of the fact. */
	label: string;
	children: ReactNode;
	/** A grid span, for a fact with a long value. */
	className?: string;
};

// One name and value pair of the definition list.
function Fact({ label, children, className }: FactProps) {
	return (
		<div className={className}>
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="mt-0.5 font-medium">{children}</dd>
		</div>
	);
}
