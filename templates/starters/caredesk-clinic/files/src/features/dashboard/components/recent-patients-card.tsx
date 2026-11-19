// The recent patients card of the home: the last 5 patients seen, with their contact and the reason of the visit.
// DashboardPage renders it in the 3/7 column of the last band, with every appointment of the book.
import { CaretRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type AppointmentRow, PersonAvatar } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// The card lists 5 patients, as the kit patient card does.
const SHOWN_PATIENTS = 5;

type RecentPatientsCardProps = {
	/** Every appointment of the book, oldest first. */
	rows: AppointmentRow[];
};

/** One row per patient: a patient seen twice shows only the last visit. */
export function RecentPatientsCard({ rows }: RecentPatientsCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const latest = new Map<string, AppointmentRow>();
	// The rows are oldest first, so a reverse walk meets the last visit of each patient first.
	for (const row of [...rows].reverse()) {
		if (latest.size === SHOWN_PATIENTS) {
			break;
		}
		if (row.status === "completed" && !latest.has(row.patientId)) {
			latest.set(row.patientId, row);
		}
	}

	return (
		<Card className="@4xl/main:col-span-3">
			<CardHeader>
				<CardTitle>{t("dashboard.recentPatientsTitle")}</CardTitle>
				<CardAction>
					<Button asChild variant="outline">
						<Link to="/app/patients">
							{t("common.viewAll")}
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{latest.size === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						{t("dashboard.noVisit")}
					</p>
				) : (
					<ul className="grid gap-6">
						{[...latest.values()].map((row) => (
							<li key={row.id}>
								<Link
									to="/app/patients/$patientId"
									params={{ patientId: row.patient.id }}
									className="flex items-center gap-3 rounded-md outline-none hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<PersonAvatar
										name={row.patient.fullName}
										className="size-9"
									/>
									<span className="grid min-w-0 flex-1 gap-1">
										<span
											className="truncate font-medium leading-none"
											dir="auto"
										>
											{row.patient.fullName}
										</span>
										<span
											className="truncate text-muted-foreground text-sm"
											dir="ltr"
										>
											{row.patient.email ?? row.patient.phone}
										</span>
									</span>
									<span className="grid shrink-0 justify-items-end gap-1 text-end">
										<span className="max-w-40 truncate font-medium text-sm">
											{row.reason}
										</span>
										<span className="text-muted-foreground text-sm tabular-nums">
											{date.format(row.startsAt)}
										</span>
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
