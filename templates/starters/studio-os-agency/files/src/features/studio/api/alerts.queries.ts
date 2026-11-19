// Reads of the header alerts: the overdue invoices and the late deliverables, the oldest first.
// HeaderNotifications of the app shell reads it after the shell renders.
// An overdue invoice is the "Overdue" status of the Invoices page, so the bell and the list count the same rows.
// The queryFn reads the sample rows. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { getStudioData } from "../lib/sample-data";
import { type Day, daysFromToday } from "../lib/time";

// Each alert opens the page of its project. linkOptions types the path, so a wrong path fails typecheck.
function projectLink(projectId: string) {
	return linkOptions({ to: "/app/projects/$projectId", params: { projectId } });
}

/** One alert of the bell menu. */
export type Alert = {
	id: string;
	/** "overdueInvoice": a sent invoice past its due day. "lateDeliverable": open work past its due day. */
	kind: "overdueInvoice" | "lateDeliverable";
	/** The invoice number or the deliverable name. */
	title: string;
	/** The client of the invoice, or the project of the deliverable. */
	detail: string;
	/** The due day that passed. */
	at: Day;
	link: ReturnType<typeof projectLink>;
};

/** Every alert, the oldest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const data = getStudioData();
			const clientName = new Map(
				data.clients.map((client) => [client.id, client.name]),
			);
			const projectName = new Map(
				data.projects.map((project) => [project.id, project.name]),
			);
			const overdueInvoices: Alert[] = data.invoices
				.filter((invoice) => invoice.status === "overdue")
				.map((invoice) => ({
					id: invoice.id,
					kind: "overdueInvoice",
					title: invoice.number ?? invoice.id,
					detail: clientName.get(invoice.clientId) ?? "",
					at: invoice.dueDay,
					link: projectLink(invoice.projectId),
				}));
			const lateDeliverables: Alert[] = data.deliverables
				.filter(
					(deliverable) =>
						deliverable.status !== "approved" &&
						daysFromToday(deliverable.dueDay) < 0,
				)
				.map((deliverable) => ({
					id: deliverable.id,
					kind: "lateDeliverable",
					title: deliverable.name,
					detail: projectName.get(deliverable.projectId) ?? "",
					at: deliverable.dueDay,
					link: projectLink(deliverable.projectId),
				}));
			return [...overdueInvoices, ...lateDeliverables].sort((first, second) =>
				first.at.localeCompare(second.at),
			);
		},
	});
}
