// Pure formatting: lead DTOs → the exact grid written to the Google Sheet.
// Every sync is a full rewrite, so this is the single place that decides what
// the merchant's spreadsheet looks like. French labels and Algiers-local
// times on purpose — the sheet is for Algerian merchants, not for the API.
import {
	createLeadExtrasColumns,
	dedupeLeadExportHeaderLabels,
	LEAD_EXTRA_OVERFLOW_LABEL,
	type Lead,
	type LeadSource,
	type LeadStatus,
} from "@wandit/contracts";

export const LEAD_SHEET_HEADER = [
	"Nom",
	"Téléphone",
	"Wilaya",
	"Commune",
	"Statut",
	"Source",
	"Date",
] as const;

const STATUS_LABELS: Record<LeadStatus, string> = {
	cancelled: "Annulé",
	confirmed: "Confirmé",
	delivered: "Livré",
	returned: "Retourné",
	shipped: "Expédié",
	to_confirm: "À confirmer",
};

const SOURCE_LABELS: Record<LeadSource, string> = {
	direct: "Direct",
	facebook: "Facebook",
	tiktok: "TikTok",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	month: "2-digit",
	timeZone: "Africa/Algiers",
	year: "numeric",
});

/**
 * Accumulates the grid for one full rewrite. Each AI-generated page collects
 * different form fields, so beyond the fixed columns every public extras key
 * gets its own column. Pages of leads stream through addRows() while the
 * extras columns grow with each newly seen field; rows emitted earlier are
 * simply blank in later-added columns. header() is only complete once every
 * lead has been added — the sync therefore writes the header row last.
 */
export class LeadSheetGrid {
	private readonly extrasColumns = createLeadExtrasColumns();

	addRows(leads: Lead[]): string[][] {
		return leads.map((lead) => [
			lead.name,
			lead.phone,
			lead.wilaya ?? "",
			lead.commune ?? "",
			STATUS_LABELS[lead.status],
			SOURCE_LABELS[lead.source],
			dateFormatter.format(new Date(lead.createdAt)),
			...this.extrasColumns.buildCells(lead.extras),
		]);
	}

	header(): string[] {
		return [
			...LEAD_SHEET_HEADER,
			...dedupeLeadExportHeaderLabels(
				[...LEAD_SHEET_HEADER, LEAD_EXTRA_OVERFLOW_LABEL],
				this.extrasColumns.keys(),
			),
			...(this.extrasColumns.hasOverflow() ? [LEAD_EXTRA_OVERFLOW_LABEL] : []),
		];
	}
}

export function buildLeadSheetValues(leads: Lead[]): string[][] {
	const grid = new LeadSheetGrid();
	const rows = grid.addRows(leads);
	return [grid.header(), ...rows];
}
