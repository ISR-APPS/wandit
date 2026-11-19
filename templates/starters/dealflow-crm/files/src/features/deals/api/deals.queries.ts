// Reads of deals: the list, and one deal with its contact and stage history.
// The route loaders prefetch them. The home, the Deals page, and the deal page read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	type DealSource,
	type DealStage,
	getSampleTables,
	type LostReason,
	type SampleTables,
} from "~/features/crm";

/** One deal with the names that a list shows. The times are ISO texts. */
export type Deal = {
	id: string;
	/** What the customer buys, for example "Multi-site rollout". */
	name: string;
	stage: DealStage;
	/** Whole units of the app currency. */
	amount: number;
	source: DealSource;
	createdAt: string;
	/** When the deal entered its current stage. The age in the stage counts from it. */
	stageChangedAt: string;
	/** The day the rep expects to close. */
	expectedCloseAt: string;
	/** When the deal was won or lost. null while it is open. */
	closedAt: string | null;
	/** Set only on a lost deal. */
	lostReason: LostReason | null;
	companyId: string;
	companyName: string;
	/** The name of the main contact of the deal. */
	contactName: string;
	ownerId: string;
	/** The name of the rep that owns the deal. */
	ownerName: string;
	/** The newest logged activity of the deal. The stage change time when the deal has none. */
	lastActivityAt: string;
	/** Every logged call, email, meeting, and note of the deal. The board card shows it. */
	activityCount: number;
	/** The open follow-up tasks of the deal. The board card shows it. */
	openTaskCount: number;
};

/** One deal with the records that only its own page shows. */
export type DealDetail = Deal & {
	/** The main contact of the deal. */
	contact: { name: string; title: string; email: string; phone: string };
	company: { industry: string; city: string; employees: number };
	/** Each move into a stage, oldest first. The first row is the creation as a lead. */
	stageHistory: { stage: DealStage; changedAt: string }[];
};

// Adds the company, contact, owner, last activity, and the counts to deal rows. A database join does this later.
function withNames(rows: SampleTables["deals"], tables: SampleTables): Deal[] {
	const reps = new Map(tables.reps.map((rep) => [rep.id, rep]));
	const contacts = new Map(tables.contacts.map((row) => [row.id, row]));
	const companies = new Map(tables.companies.map((row) => [row.id, row]));
	// The activity rows are in time order, so the last write per deal is its newest activity.
	const lastActivity = new Map<string, string>();
	const activityCount = new Map<string, number>();
	for (const activity of tables.activities) {
		if (activity.dealId) {
			lastActivity.set(activity.dealId, activity.occurredAt);
			activityCount.set(
				activity.dealId,
				(activityCount.get(activity.dealId) ?? 0) + 1,
			);
		}
	}
	const taskCount = new Map<string, number>();
	for (const task of tables.tasks) {
		taskCount.set(task.dealId, (taskCount.get(task.dealId) ?? 0) + 1);
	}
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		stage: row.stage,
		amount: row.amount,
		source: row.source,
		createdAt: row.createdAt,
		stageChangedAt: row.stageChangedAt,
		expectedCloseAt: row.expectedCloseAt,
		closedAt: row.closedAt,
		lostReason: row.lostReason,
		companyId: row.companyId,
		companyName: companies.get(row.companyId)?.name ?? "",
		contactName: contacts.get(row.contactId)?.name ?? "",
		ownerId: row.ownerId,
		ownerName: reps.get(row.ownerId)?.name ?? "",
		lastActivityAt: lastActivity.get(row.id) ?? row.stageChangedAt,
		activityCount: activityCount.get(row.id) ?? 0,
		openTaskCount: taskCount.get(row.id) ?? 0,
	}));
}

/** Every deal, the newest activity first. The board groups them by stage; the tables filter, sort, and page them. */
export function dealsQueryOptions() {
	return queryOptions({
		queryKey: ["deals", "list"],
		queryFn: async () => {
			const tables = getSampleTables();
			// LIMIT: every deal in one read, grouped and paged in the browser. Upgrade: a limit of 1,000 with server paging (tables-paging.md of the app-dashboard skill).
			return withNames(tables.deals, tables).sort((first, second) =>
				second.lastActivityAt.localeCompare(first.lastActivityAt),
			);
		},
	});
}

/** One deal with its contact, company, and stage history. null when the id does not exist. */
export function dealQueryOptions(id: string) {
	return queryOptions({
		queryKey: ["deals", "detail", id],
		queryFn: async (): Promise<DealDetail | null> => {
			const tables = getSampleTables();
			const row = tables.deals.find((deal) => deal.id === id);
			const contact = tables.contacts.find(
				(person) => person.id === row?.contactId,
			);
			const company = tables.companies.find(
				(item) => item.id === row?.companyId,
			);
			// The id comes from the URL. An unknown id is "not found", not an error.
			if (!row || !contact || !company) {
				return null;
			}
			const [deal] = withNames([row], tables);
			if (!deal) {
				return null;
			}
			return {
				...deal,
				contact: {
					name: contact.name,
					title: contact.title,
					email: contact.email,
					phone: contact.phone,
				},
				company: {
					industry: company.industry,
					city: company.city,
					employees: company.employees,
				},
				stageHistory: tables.stageChanges
					.filter((change) => change.dealId === id)
					.map((change) => ({
						stage: change.stage,
						changedAt: change.changedAt,
					}))
					.sort((first, second) =>
						first.changedAt.localeCompare(second.changedAt),
					),
			};
		},
	});
}
