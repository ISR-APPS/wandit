// Reads of the people at customer companies: the list, and the deals of one person.
// The contacts route prefetches the list. The contact panel reads the deals of a person after a click.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { type DealStage, getSampleTables, isOpenStage } from "~/features/crm";

/** One person at a customer company, with the numbers that the list shows. */
export type Contact = {
	id: string;
	name: string;
	/** The job title, for example "Operations Director". */
	title: string;
	email: string;
	phone: string;
	companyId: string;
	companyName: string;
	/** The city of the company. */
	city: string;
	/** Deals with this person as the main contact that are not won or lost. */
	openDealCount: number;
	/** ISO time of the newest logged activity with this person. null when no activity exists. */
	lastContactedAt: string | null;
};

/** One deal of a contact, as the contact panel lists it. */
export type ContactDeal = {
	id: string;
	name: string;
	stage: DealStage;
	/** Whole units of the app currency. */
	amount: number;
};

/** Every contact, in name order. The people table searches, sorts, and pages them in the browser. */
export function contactsQueryOptions() {
	return queryOptions({
		queryKey: ["contacts", "list"],
		queryFn: async (): Promise<Contact[]> => {
			const tables = getSampleTables();
			const companies = new Map(tables.companies.map((row) => [row.id, row]));
			// The activity rows are in time order, so the last write per contact is the newest activity.
			const lastContacted = new Map<string, string>();
			for (const activity of tables.activities) {
				lastContacted.set(activity.contactId, activity.occurredAt);
			}
			// LIMIT: every contact in one read, paged in the browser. Upgrade: a limit of 1,000 with server paging (tables-paging.md of the app-dashboard skill).
			return tables.contacts
				.map((row) => {
					const company = companies.get(row.companyId);
					return {
						id: row.id,
						name: row.name,
						title: row.title,
						email: row.email,
						phone: row.phone,
						companyId: row.companyId,
						companyName: company?.name ?? "",
						city: company?.city ?? "",
						openDealCount: tables.deals.filter(
							(deal) => deal.contactId === row.id && isOpenStage(deal.stage),
						).length,
						lastContactedAt: lastContacted.get(row.id) ?? null,
					};
				})
				.sort((first, second) => first.name.localeCompare(second.name));
		},
	});
}

/** The deals with one person as the main contact, newest first. The contact panel reads it after a click. */
export function contactDealsQueryOptions(contactId: string) {
	return queryOptions({
		queryKey: ["contacts", "deals", contactId],
		queryFn: async (): Promise<ContactDeal[]> =>
			getSampleTables()
				.deals.filter((deal) => deal.contactId === contactId)
				.sort((first, second) =>
					second.createdAt.localeCompare(first.createdAt),
				)
				.map((deal) => ({
					id: deal.id,
					name: deal.name,
					stage: deal.stage,
					amount: deal.amount,
				})),
	});
}
