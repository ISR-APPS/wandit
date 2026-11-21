// The upcoming card of the home: the next 7 expected patients in a table, with a row menu, an export, and a link to the calendar.
// DashboardPage renders it in the 4/7 column of the last band, with every appointment of the book.
// "Export" downloads every expected appointment of the book as CSV, not only the 7 rows.
import {
	CaretRightIcon,
	DotsThreeVerticalIcon,
	ExportIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { appointmentCsvColumns } from "~/features/appointments";
import {
	type AppointmentRow,
	copyToClipboard,
	downloadCsv,
	isComing,
	toCsv,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

// The card lists 7 rows, as the kit appointment card does.
const SHOWN_ROWS = 7;

type UpcomingCardProps = {
	/** Every appointment of the book, oldest first. */
	rows: AppointmentRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
};

/** The table scrolls sideways inside the card on a phone. */
export function UpcomingCard({ rows, now }: UpcomingCardProps) {
	const { t, locale } = useT();
	const upcoming = rows.filter((row) => isComing(row, now));
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });

	return (
		<Card className="@4xl/main:col-span-4">
			<CardHeader>
				<CardTitle>{t("dashboard.upcomingTitle")}</CardTitle>
				<CardAction className="flex gap-2">
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={() =>
							downloadCsv(
								"upcoming-appointments.csv",
								toCsv(upcoming, appointmentCsvColumns(t, locale)),
							)
						}
					>
						<ExportIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
					<Button
						asChild
						variant="outline"
						size="icon"
						aria-label={t("dashboard.openCalendar")}
					>
						<Link to="/app/appointments">
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("appointments.patient")}</TableHead>
								<TableHead>{t("appointments.date")}</TableHead>
								<TableHead>{t("appointments.time")}</TableHead>
								<TableHead>{t("appointments.practitioner")}</TableHead>
								<TableHead>{t("appointments.department")}</TableHead>
								<TableHead className="w-12">
									<span className="sr-only">{t("table.actions")}</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{upcoming.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="h-24 text-center text-muted-foreground"
									>
										{t("dashboard.noUpcoming")}
									</TableCell>
								</TableRow>
							) : (
								upcoming.slice(0, SHOWN_ROWS).map((row) => (
									<TableRow key={row.id}>
										<TableCell className="font-medium">
											<Link
												to="/app/patients/$patientId"
												params={{ patientId: row.patient.id }}
												className="hover:underline"
												dir="auto"
											>
												{row.patient.fullName}
											</Link>
										</TableCell>
										<TableCell className="tabular-nums">
											{date.format(row.startsAt)}
										</TableCell>
										<TableCell className="tabular-nums">
											{time.format(row.startsAt)}
										</TableCell>
										<TableCell>{row.practitioner.fullName}</TableCell>
										<TableCell>
											{t(`specialties.${row.practitioner.specialty}`)}
										</TableCell>
										<TableCell className="text-end">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="size-8"
														aria-label={t("table.rowActions")}
													>
														<DotsThreeVerticalIcon className="size-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="min-w-44">
													<DropdownMenuItem asChild>
														<Link
															to="/app/appointments"
															search={{ appointment: row.id }}
														>
															{t("dashboard.openAppointment")}
														</Link>
													</DropdownMenuItem>
													<DropdownMenuItem asChild>
														<Link
															to="/app/patients/$patientId"
															params={{ patientId: row.patient.id }}
														>
															{t("appointments.openFile")}
														</Link>
													</DropdownMenuItem>
													<DropdownMenuItem
														onSelect={() =>
															copyToClipboard(row.patient.phone, {
																done: t("table.copied"),
																failed: t("table.copyFailed"),
															})
														}
													>
														{t("dashboard.copyPhone")}
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}
