// Joins of the sample tables for the client pages: one summary row per client, and the file of one client.
// clients.queries.ts calls these functions in its queryFn. The money sums come from the matter summaries,
// so a client total always equals the sum of its matters on the matter pages.
import { buildMatterSummaries, type MatterSummary } from "~/features/matters";
import {
	type ClientRow,
	type InvoiceRow,
	isOpenStage,
	type SampleTables,
} from "~/features/practice";

/** One client with the counts and the totals of its matters. Amounts are whole USD. */
export type ClientSummary = ClientRow & {
	/** The opening of the first matter of the client, as ISO. null when the client has no matter yet. */
	since: string | null;
	matterCount: number;
	openMatterCount: number;
	billed: number;
	outstanding: number;
	/** The part of `outstanding` that is past its due date. */
	overdue: number;
};

/** One invoice of the client with the name and the number of its matter. */
export type ClientInvoice = InvoiceRow & { matterName: string };

/** Everything the client sheet shows. */
export type ClientFile = {
	client: ClientSummary;
	/** Open matters first, then by newest opening. */
	matters: MatterSummary[];
	/** Newest first. */
	invoices: ClientInvoice[];
};

function summarize(client: ClientRow, matters: MatterSummary[]): ClientSummary {
	return {
		...client,
		since: matters.reduce<string | null>(
			(earliest, matter) =>
				earliest === null || matter.openedAt < earliest
					? matter.openedAt
					: earliest,
			null,
		),
		matterCount: matters.length,
		openMatterCount: matters.filter((matter) => isOpenStage(matter.stage))
			.length,
		billed: matters.reduce((sum, matter) => sum + matter.ledger.billed, 0),
		outstanding: matters.reduce(
			(sum, matter) => sum + matter.ledger.outstanding,
			0,
		),
		overdue: matters.reduce((sum, matter) => sum + matter.ledger.overdue, 0),
	};
}

/** Every client as a summary row, in the order of the names. */
export function buildClientSummaries(tables: SampleTables): ClientSummary[] {
	const matters = buildMatterSummaries(tables);
	return tables.clients
		.map((client) =>
			summarize(
				client,
				matters.filter((matter) => matter.clientId === client.id),
			),
		)
		.sort((first, second) => first.name.localeCompare(second.name));
}

/** The file of one client, or null when the id does not exist. */
export function buildClientFile(
	tables: SampleTables,
	clientId: string,
): ClientFile | null {
	const client = tables.clients.find((row) => row.id === clientId);
	if (!client) {
		return null;
	}
	const matters = buildMatterSummaries(tables)
		.filter((matter) => matter.clientId === clientId)
		.sort(
			(first, second) =>
				Number(isOpenStage(second.stage)) - Number(isOpenStage(first.stage)) ||
				second.openedAt.localeCompare(first.openedAt),
		);
	const matterName = new Map(matters.map((matter) => [matter.id, matter.name]));
	return {
		client: summarize(client, matters),
		matters,
		invoices: tables.invoices
			.filter((invoice) => invoice.clientId === clientId)
			.map((invoice) => ({
				...invoice,
				matterName: matterName.get(invoice.matterId) ?? "",
			}))
			.sort(
				(first, second) =>
					second.issuedAt.localeCompare(first.issuedAt) ||
					second.number.localeCompare(first.number),
			),
	};
}
