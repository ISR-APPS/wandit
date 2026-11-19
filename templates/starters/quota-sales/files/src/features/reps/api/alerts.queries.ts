// Reads of the header alerts: every rep behind the pace of the current quarter, the largest shortfall first.
// HeaderNotifications reads it after the shell renders. It uses the pace rule of the reps board,
// so the bell counts the same reps as the "Behind" pace filter of the reps page.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import {
	getSampleTables,
	localDateTimeOf,
	quarterOfDay,
	quarterProgressOf,
	todayDayNumber,
} from "~/features/sales";
import { summarize } from "./reps.queries";

// Each alert opens the page of its rep. linkOptions types the path, so a wrong path fails typecheck.
function repLink(repId: string) {
	return linkOptions({ to: "/app/reps/$repId", params: { repId } });
}

/** One alert of the bell menu. */
export type Alert = {
	/** The rep id. */
	id: string;
	/** "behindPace": the rep books under 90 % of the amount that a linear pace expects by today. */
	kind: "behindPace";
	/** The rep name. */
	title: string;
	/** The territory of the rep, for example "Pacific". */
	detail: string;
	/** ISO time of the last booking of the rep, or the start of the quarter with no booking. */
	at: string;
	link: ReturnType<typeof repLink>;
};

/** Every alert, the largest shortfall first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const tables = getSampleTables(todayDayNumber());
			const quarter = quarterOfDay(tables.today);
			const { pace } = quarterProgressOf(quarter, tables.today);
			const lastOrderAt = new Map<string, string>();
			for (const order of tables.orders) {
				if (!order.isCancelled && order.day >= quarter.startDay) {
					// The orders are oldest first, so the last write per rep is its newest order.
					lastOrderAt.set(
						order.repId,
						localDateTimeOf(order.day, order.minutes).toISOString(),
					);
				}
			}
			return summarize(tables, quarter, tables.today)
				.filter((rep) => rep.status === "behind")
				.map((rep) => ({
					rep,
					shortfall: rep.target * pace - rep.booked,
				}))
				.sort((first, second) => second.shortfall - first.shortfall)
				.map(({ rep }) => ({
					id: rep.id,
					kind: "behindPace",
					title: rep.name,
					detail: rep.territoryName,
					at:
						lastOrderAt.get(rep.id) ??
						localDateTimeOf(quarter.startDay, 0).toISOString(),
					link: repLink(rep.id),
				}));
		},
	});
}
