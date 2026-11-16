// Joins of the sample tables for the matter pages: one summary row per matter, and the full file of one matter.
// matters.queries.ts calls these functions in its queryFn. The board and the client pages reuse the summaries.
// A later database does the same joins in a SQL view; the shapes stay.
import {
	buildMatterLedgers,
	type ClientRow,
	type DeadlineRow,
	type InvoiceRow,
	ledgerOf,
	type MatterLedger,
	type MatterRow,
	type SampleTables,
	type StageChangeRow,
	type TimeEntryRow,
	toTenths,
} from "~/features/practice";

/** One matter with the names and the totals that a list row shows. */
export type MatterSummary = MatterRow & {
	clientName: string;
	leadName: string;
	/** The earliest future deadline. null when the matter has none, and on every ended matter. */
	nextDeadline: DeadlineRow | null;
	/** Hours and money of the matter, the same sums on every page. */
	ledger: MatterLedger;
};

/** One time entry with the name of the person who logged it. */
export type TimeEntryLine = TimeEntryRow & { attorneyName: string };

/** One person of the matter team with their logged hours on it. */
export type TeamMember = {
	attorneyId: string;
	name: string;
	/** The message key suffix of the role, for example "partner". */
	role: SampleTables["attorneys"][number]["role"];
	hours: number;
	isLead: boolean;
};

/** Everything the detail page shows about one matter. */
export type MatterFile = {
	matter: MatterSummary;
	client: ClientRow;
	/** Oldest first. */
	stageChanges: StageChangeRow[];
	/** Soonest first. */
	deadlines: DeadlineRow[];
	/** Newest first. */
	entries: TimeEntryLine[];
	/** Newest first. */
	invoices: InvoiceRow[];
	/** The lead first, then by hours. */
	team: TeamMember[];
};

/** Every matter as a summary row, newest opening first. */
export function buildMatterSummaries(tables: SampleTables): MatterSummary[] {
	const ledgers = buildMatterLedgers(tables);
	const clientName = new Map(
		tables.clients.map((client) => [client.id, client.name]),
	);
	const attorneyName = new Map(
		tables.attorneys.map((attorney) => [attorney.id, attorney.name]),
	);
	// The deadline table holds only future rows, so the soonest row of a matter is its next deadline.
	const nextDeadline = new Map<string, DeadlineRow>();
	for (const deadline of tables.deadlines) {
		const current = nextDeadline.get(deadline.matterId);
		if (!current || deadline.dueAt < current.dueAt) {
			nextDeadline.set(deadline.matterId, deadline);
		}
	}
	return tables.matters
		.map((matter) => ({
			...matter,
			clientName: clientName.get(matter.clientId) ?? "",
			leadName: attorneyName.get(matter.leadId) ?? "",
			nextDeadline: nextDeadline.get(matter.id) ?? null,
			ledger: ledgerOf(ledgers, matter.id),
		}))
		.sort(
			(first, second) =>
				second.openedAt.localeCompare(first.openedAt) ||
				second.number.localeCompare(first.number),
		);
}

/** The file of one matter, or null when the id does not exist. */
export function buildMatterFile(
	tables: SampleTables,
	matterId: string,
): MatterFile | null {
	const matter = buildMatterSummaries(tables).find(
		(summary) => summary.id === matterId,
	);
	const client = tables.clients.find((row) => row.id === matter?.clientId);
	if (!matter || !client) {
		return null;
	}
	const attorneys = new Map(
		tables.attorneys.map((attorney) => [attorney.id, attorney]),
	);
	const entries = tables.timeEntries
		.filter((entry) => entry.matterId === matterId)
		.map((entry) => ({
			...entry,
			attorneyName: attorneys.get(entry.attorneyId)?.name ?? "",
		}))
		.sort((first, second) => second.day.localeCompare(first.day));
	const hoursByAttorney = new Map<string, number>([[matter.leadId, 0]]);
	for (const entry of entries) {
		hoursByAttorney.set(
			entry.attorneyId,
			(hoursByAttorney.get(entry.attorneyId) ?? 0) + entry.hours,
		);
	}
	const team = [...hoursByAttorney.entries()]
		.flatMap(([attorneyId, hours]) => {
			const attorney = attorneys.get(attorneyId);
			return attorney
				? [
						{
							attorneyId,
							name: attorney.name,
							role: attorney.role,
							hours: toTenths(hours),
							isLead: attorneyId === matter.leadId,
						},
					]
				: [];
		})
		.sort(
			(first, second) =>
				Number(second.isLead) - Number(first.isLead) ||
				second.hours - first.hours,
		);
	return {
		matter,
		client,
		stageChanges: tables.stageChanges
			.filter((change) => change.matterId === matterId)
			.sort((first, second) => first.changedAt.localeCompare(second.changedAt)),
		deadlines: tables.deadlines
			.filter((deadline) => deadline.matterId === matterId)
			.sort((first, second) => first.dueAt.localeCompare(second.dueAt)),
		entries,
		invoices: tables.invoices
			.filter((invoice) => invoice.matterId === matterId)
			.sort((first, second) => second.issuedAt.localeCompare(first.issuedAt)),
		team,
	};
}
