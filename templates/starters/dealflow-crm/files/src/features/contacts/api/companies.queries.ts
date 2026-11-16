// Reads of the customer companies: the list with the totals of each company.
// The contacts route prefetches it. The companies table reads it from the cache.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { getSampleTables, isOpenStage } from "~/features/crm";

/** One customer company, with the totals that the list shows. */
export type Company = {
	id: string;
	name: string;
	/** Free text, for example "Logistics". */
	industry: string;
	city: string;
	/** Head count of the company. */
	employees: number;
	/** People of this company in the contact list. */
	contactCount: number;
	/** Deals of this company that are not won or lost. */
	openDealCount: number;
	/** The sum of the open deals, in whole units of the app currency. */
	openAmount: number;
	/** The sum of the won deals, in whole units of the app currency. */
	wonAmount: number;
};

/** Every company, in name order. The companies table searches, sorts, and pages them in the browser. */
export function companiesQueryOptions() {
	return queryOptions({
		queryKey: ["companies", "list"],
		queryFn: async (): Promise<Company[]> => {
			const tables = getSampleTables();
			return tables.companies
				.map((row) => {
					const deals = tables.deals.filter(
						(deal) => deal.companyId === row.id,
					);
					const openDeals = deals.filter((deal) => isOpenStage(deal.stage));
					return {
						...row,
						contactCount: tables.contacts.filter(
							(person) => person.companyId === row.id,
						).length,
						openDealCount: openDeals.length,
						openAmount: openDeals.reduce((sum, deal) => sum + deal.amount, 0),
						wonAmount: deals
							.filter((deal) => deal.stage === "won")
							.reduce((sum, deal) => sum + deal.amount, 0),
					};
				})
				.sort((first, second) => first.name.localeCompare(second.name));
		},
	});
}
