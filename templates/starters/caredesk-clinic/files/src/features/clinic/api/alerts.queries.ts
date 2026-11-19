// Reads of the header alerts: the patients who are late now, and the no-shows of today, the oldest first.
// HeaderNotifications reads it after the shell renders. The late rule is `isLate`, as on the calendar and the queue.
// The queryFn reads the sample rows. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { LIVE_REFETCH_MS } from "../hooks/use-now";
import { listAppointmentRows, rowsOfDay } from "../lib/appointment-rows";
import { addDays, startOfLocalDay, startOfMinute } from "../lib/clinic-day";
import { isLate } from "../lib/sample-appointments";

// Each alert opens the appointment panel of the calendar. linkOptions types the path, so a wrong path fails typecheck.
function appointmentLink(appointmentId: string) {
	return linkOptions({
		to: "/app/appointments",
		search: { appointment: appointmentId },
	});
}

/** One alert of the bell menu. */
export type Alert = {
	/** The appointment id. */
	id: string;
	/** "late": an expected patient after the start time. "noShow": a patient who did not come today. */
	kind: "late" | "noShow";
	/** The patient name. */
	title: string;
	/** The practitioner name. */
	detail: string;
	/** The planned start, in milliseconds since 1970. */
	at: number;
	link: ReturnType<typeof appointmentLink>;
};

/** Every alert of today, the oldest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const now = startOfMinute(Date.now());
			const todayStart = startOfLocalDay(now);
			return rowsOfDay(
				listAppointmentRows(now),
				todayStart,
				addDays(todayStart, 1),
			).flatMap((row): Alert[] => {
				const kind = isLate(row, now)
					? "late"
					: row.status === "no_show"
						? "noShow"
						: null;
				return kind === null
					? []
					: [
							{
								id: row.id,
								kind,
								title: row.patient.fullName,
								detail: row.practitioner.fullName,
								at: row.startsAt,
								link: appointmentLink(row.id),
							},
						];
			});
		},
		// A patient turns late while the page stays open, so the bell refetches with the live pages.
		refetchInterval: LIVE_REFETCH_MS,
	});
}
