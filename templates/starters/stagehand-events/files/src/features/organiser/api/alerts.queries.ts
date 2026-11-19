// Reads of the header alerts: the events that sell slowly before their day, and the new refund requests.
// HeaderNotifications reads it after the shell renders. The rules are in lib/alerts.ts.
// The queryFn reads the sample box office. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { buildAlerts } from "../lib/alerts";
import { loadBoxOffice } from "../lib/box-office";

/** Every alert, the most urgent first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async () => buildAlerts(loadBoxOffice(Date.now())),
	});
}
