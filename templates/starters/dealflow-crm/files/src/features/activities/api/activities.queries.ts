// Reads of the logged activities: the log, the activities of one deal or one contact, the daily series, and the breakdown.
// The route loaders prefetch them. The pages and the cards read them from the cache.
// Each queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	ACTIVITY_TYPES,
	type ActivityType,
	type BreakdownSlice,
	buildDailySeries,
	calendarDaysFromNow,
	getSampleTables,
	type PeriodDays,
	type SampleTables,
} from "~/features/crm";

/**
 * The period of the first load of the trend, and the fixed period of the breakdown and of the log, in days.
 * The three cards count the same days, so their totals agree.
 */
export const ACTIVITY_DEFAULT_DAYS = 30 satisfies PeriodDays;

/** One logged activity with the names that a list shows. */
export type Activity = {
	id: string;
	type: ActivityType;
	subject: string;
	/** One or two sentences of the rep. */
	note: string;
	/** ISO time of the call, the email, the meeting, or the note. */
	occurredAt: string;
	/** The rep that logged it. */
	repName: string;
	contactName: string;
	companyName: string;
	/** The deal of the activity. null for prospecting work with no deal yet. */
	deal: { id: string; name: string } | null;
};

// Adds the names of the rep, the contact, the company, and the deal to activity rows. A database join does this later.
function withNames(
	rows: SampleTables["activities"],
	tables: SampleTables,
): Activity[] {
	const reps = new Map(tables.reps.map((rep) => [rep.id, rep]));
	const contacts = new Map(tables.contacts.map((row) => [row.id, row]));
	const companies = new Map(tables.companies.map((row) => [row.id, row]));
	const deals = new Map(tables.deals.map((row) => [row.id, row]));
	return rows.map((row) => {
		const contact = contacts.get(row.contactId);
		const deal = row.dealId ? deals.get(row.dealId) : undefined;
		return {
			id: row.id,
			type: row.type,
			subject: row.subject,
			note: row.note,
			occurredAt: row.occurredAt,
			repName: reps.get(row.repId)?.name ?? "",
			contactName: contact?.name ?? "",
			companyName: companies.get(contact?.companyId ?? "")?.name ?? "",
			deal: deal ? { id: deal.id, name: deal.name } : null,
		};
	});
}

// Newest first. ISO times of one format sort as text.
function byNewest(
	first: { occurredAt: string },
	second: { occurredAt: string },
): number {
	return second.occurredAt.localeCompare(first.occurredAt);
}

// The rows of the last `days` calendar days, today included. The daily series counts the same days.
function inLastDays(
	rows: SampleTables["activities"],
	days: number,
): SampleTables["activities"] {
	const now = Date.now();
	return rows.filter((row) => calendarDaysFromNow(row.occurredAt, now) > -days);
}

/** The activities of the team in the last `days` days, newest first. The log table searches, sorts, and pages them in the browser. */
export function activitiesQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["activities", "list", days],
		queryFn: async () => {
			const tables = getSampleTables();
			// LIMIT: every row of the period in one read, about 350 rows for 30 days. Upgrade: server paging (tables-paging.md of the app-dashboard skill).
			const rows = inLastDays(tables.activities, days);
			return withNames(rows.sort(byNewest), tables);
		},
	});
}

/** Every activity of one deal, newest first. The timeline of the deal page reads it. */
export function dealActivitiesQueryOptions(dealId: string) {
	return queryOptions({
		queryKey: ["activities", "deal", dealId],
		queryFn: async () => {
			const tables = getSampleTables();
			const rows = tables.activities.filter((row) => row.dealId === dealId);
			return withNames(rows.sort(byNewest), tables);
		},
	});
}

/** The 6 newest activities with one contact. The contact panel reads it after a click. */
export function contactActivitiesQueryOptions(contactId: string) {
	return queryOptions({
		queryKey: ["activities", "contact", contactId],
		queryFn: async () => {
			const tables = getSampleTables();
			const rows = tables.activities.filter(
				(row) => row.contactId === contactId,
			);
			return withNames(rows.sort(byNewest).slice(0, 6), tables);
		},
	});
}

/** Activities per day for the last `days` days, with the same days one period earlier. Feeds the trend card. */
export function dailyActivitiesQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["activities", "daily", days],
		queryFn: async () =>
			buildDailySeries(
				getSampleTables().activities.map((row) => ({
					occurredAt: row.occurredAt,
					value: 1,
				})),
				days,
				Date.now(),
			),
	});
}

/** Counts of the activities of the last `days` days: by type and by rep, each largest first. */
export type ActivityBreakdown = {
	byType: BreakdownSlice<ActivityType>[];
	/** `label` is the name of the rep. */
	byRep: BreakdownSlice[];
};

// Largest first, so the first row of a ranked list is the widest bar.
function byLargest(first: BreakdownSlice, second: BreakdownSlice): number {
	return second.value - first.value;
}

/** The activity counts of the last `days` days by type and by rep. Feeds the breakdown card. */
export function activityBreakdownQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["activities", "breakdown", days],
		queryFn: async (): Promise<ActivityBreakdown> => {
			const tables = getSampleTables();
			const rows = inLastDays(tables.activities, days);
			return {
				byType: ACTIVITY_TYPES.map((type) => ({
					label: type,
					value: rows.filter((row) => row.type === type).length,
				})).sort(byLargest),
				byRep: tables.reps
					.map((rep) => ({
						label: rep.name,
						value: rows.filter((row) => row.repId === rep.id).length,
					}))
					.sort(byLargest),
			};
		},
	});
}
