// The activity parts of the patient file: the visit history timeline, the payments table, the care team, and the visits table.
// PatientDetailPage renders the first three in its Overview tab and the table in its Visits tab.
// Each part reads the appointments of the patient, newest first, from the detail query.
import {
	CalendarCheckIcon,
	CaretRightIcon,
	ClockIcon,
	FirstAidKitIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	type AppointmentRow,
	AppointmentStatusBadge,
	copyToClipboard,
	fillMessage,
	isComing,
	isLate,
	PAYMENT_STATUS_BADGE,
	PersonAvatar,
	type Practitioner,
	paymentStatusOf,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { PatientRow } from "../lib/patient-rows";

// The timeline shows 3 steps, the payments table 6 lines, as the kit profile cards do.
const HISTORY_ITEMS = 3;
const PAYMENT_ROWS = 6;

type VisitHistoryCardProps = {
	/** The appointments of the patient, newest first. */
	appointments: AppointmentRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
	/** Opens the Visits tab. */
	onViewAll: () => void;
};

/** The next expected appointment comes first, then the last visits that were done. */
export function VisitHistoryCard({
	appointments,
	now,
	onViewAll,
}: VisitHistoryCardProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "long",
		timeStyle: "short",
	});
	// The list is newest first, so the last expected row is the soonest one.
	const next = appointments.filter((row) => isComing(row, now)).at(-1);
	const done = appointments.filter((row) => row.status === "completed");
	const items = [...(next ? [next] : []), ...done].slice(0, HISTORY_ITEMS);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("patients.history")}</CardTitle>
				<CardAction>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="-me-2 text-muted-foreground"
						onClick={onViewAll}
					>
						{t("common.viewAll")}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{items.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("patients.noAppointments")}
					</p>
				) : (
					<ol className="relative ms-3 grid gap-8 border-s ps-7">
						{items.map((row) => {
							const isNext = row === next;
							return (
								<li key={row.id} className="relative grid gap-1.5">
									<span className="absolute -start-10.5 top-0 flex size-7 items-center justify-center rounded-full border bg-card text-muted-foreground">
										{isNext ? (
											<CalendarCheckIcon className="size-3.5" />
										) : (
											<FirstAidKitIcon className="size-3.5" />
										)}
									</span>
									<p className="flex flex-wrap items-center gap-2 font-medium">
										{t(`visitTypes.${row.visitType}`)}
										{isNext ? (
											<Badge variant="outline">{t("patients.nextBadge")}</Badge>
										) : row === done[0] ? (
											<Badge variant="outline">
												{t("patients.latestBadge")}
											</Badge>
										) : null}
									</p>
									<p className="flex items-center gap-1.5 text-muted-foreground text-sm">
										<ClockIcon className="size-3.5 shrink-0" />
										{fillMessage(t("patients.onWith"), {
											date: dateTime.format(row.startsAt),
											practitioner: row.practitioner.fullName,
										})}
									</p>
									<p className="text-muted-foreground text-sm" dir="auto">
										{row.reason}
									</p>
									{isNext ? (
										<Button
											asChild
											variant="outline"
											size="sm"
											className="mt-1 justify-self-start"
										>
											<Link
												to="/app/appointments"
												search={{ appointment: row.id }}
											>
												<CalendarCheckIcon />
												{t("patients.openAppointment")}
											</Link>
										</Button>
									) : null}
								</li>
							);
						})}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}

type PaymentsCardProps = {
	/** The appointments of the patient, newest first. */
	appointments: AppointmentRow[];
	now: number;
};

/** The payment state of the last 6 visits that were done. */
export function PaymentsCard({ appointments, now }: PaymentsCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "short" });
	const done = appointments
		.filter((row) => row.status === "completed")
		.slice(0, PAYMENT_ROWS);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("patients.payments")}</CardTitle>
			</CardHeader>
			<CardContent>
				{done.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("patients.noPayment")}
					</p>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("patients.visit")}</TableHead>
									<TableHead>{t("patients.status")}</TableHead>
									<TableHead className="text-end">
										{t("patients.date")}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{done.map((row) => {
									const status = paymentStatusOf(row, now);
									return (
										<TableRow key={row.id}>
											<TableCell>{t(`visitTypes.${row.visitType}`)}</TableCell>
											<TableCell>
												<Badge variant={PAYMENT_STATUS_BADGE[status]}>
													{t(`paymentStatuses.${status}`)}
												</Badge>
											</TableCell>
											<TableCell className="text-end tabular-nums">
												{date.format(row.startsAt)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

type CareTeamCardProps = {
	patient: PatientRow;
	/** The appointments of the patient, newest first. */
	appointments: AppointmentRow[];
};

/** The practitioner who follows the patient comes first, with a filled button. Each button opens that agenda. */
export function CareTeamCard({ patient, appointments }: CareTeamCardProps) {
	const { t } = useT();
	const team = new Map<string, Practitioner>();
	if (patient.primaryPractitioner) {
		team.set(patient.primaryPractitioner.id, patient.primaryPractitioner);
	}
	for (const row of appointments) {
		team.set(row.practitioner.id, row.practitioner);
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("patients.careTeam")}</CardTitle>
				<CardAction>
					<Button
						asChild
						variant="outline"
						size="icon"
						aria-label={t("practitioners.title")}
					>
						<Link to="/app/practitioners">
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-5">
					{[...team.values()].map((practitioner) => {
						const isPrimary = practitioner.id === patient.primaryPractitionerId;
						return (
							<li key={practitioner.id} className="flex items-center gap-3">
								<PersonAvatar
									name={practitioner.fullName}
									tone="staff"
									className="size-9"
								/>
								<span className="grid min-w-0 flex-1 gap-0.5">
									<span className="truncate font-medium text-sm">
										{practitioner.fullName}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{t(`specialties.${practitioner.specialty}`)}
									</span>
								</span>
								<Button
									asChild
									size="sm"
									variant={isPrimary ? "default" : "outline"}
								>
									<Link
										to="/app/appointments"
										search={{ practitioner: practitioner.id }}
									>
										{t("patients.agenda")}
									</Link>
								</Button>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}

type PatientVisitsTableProps = {
	/** The appointments of the patient, newest first. */
	appointments: AppointmentRow[];
	now: number;
};

/** Every appointment of the patient. A row opens the appointment on the calendar. */
export function PatientVisitsTable({
	appointments,
	now,
}: PatientVisitsTableProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const columns: RecordColumn<AppointmentRow>[] = [
		{
			id: "when",
			header: t("appointments.date"),
			sortValue: (row) => row.startsAt,
			cell: (row) => (
				<span className="tabular-nums">{dateTime.format(row.startsAt)}</span>
			),
		},
		{
			id: "visit",
			header: t("appointments.visit"),
			sortValue: (row) => t(`visitTypes.${row.visitType}`),
			cell: (row) => (
				<span className="grid">
					<span className="font-medium">
						{t(`visitTypes.${row.visitType}`)}
					</span>
					<span className="text-muted-foreground text-xs" dir="auto">
						{row.reason}
					</span>
				</span>
			),
		},
		{
			id: "practitioner",
			header: t("appointments.practitioner"),
			hideable: true,
			sortValue: (row) => row.practitioner.fullName,
			cell: (row) => row.practitioner.fullName,
		},
		{
			id: "status",
			header: t("appointments.status"),
			sortValue: (row) => row.status,
			cell: (row) => (
				<AppointmentStatusBadge status={row.status} isLate={isLate(row, now)} />
			),
		},
	];
	return (
		<RecordTable
			rows={appointments}
			columns={columns}
			searchText={(row) =>
				`${t(`visitTypes.${row.visitType}`)} ${row.reason} ${row.practitioner.fullName}`
			}
			searchPlaceholder={t("patients.filterVisits")}
			rowMenu={(row) => (
				<>
					<DropdownMenuItem asChild>
						<Link to="/app/appointments" search={{ appointment: row.id }}>
							{t("patients.openAppointment")}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							copyToClipboard(row.id, {
								done: t("table.copied"),
								failed: t("table.copyFailed"),
							})
						}
					>
						{t("table.copyId")}
					</DropdownMenuItem>
				</>
			)}
			pageSize={10}
			noResults={t("patients.noAppointments")}
		/>
	);
}
