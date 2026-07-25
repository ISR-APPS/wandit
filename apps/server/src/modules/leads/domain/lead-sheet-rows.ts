// Pure formatting: lead DTOs → the exact grid written to the Google Sheet.
// Every sync is a full rewrite, so this is the single place that decides what
// the merchant's spreadsheet looks like. French labels and Algiers-local
// times on purpose — the sheet is for Algerian merchants, not for the API.
import type { Lead, LeadSource, LeadStatus } from "@wandit/contracts";

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

export function buildLeadSheetValues(leads: Lead[]): string[][] {
	return [
		[...LEAD_SHEET_HEADER],
		...leads.map((lead) => [
			lead.name,
			lead.phone,
			lead.wilaya ?? "",
			lead.commune ?? "",
			STATUS_LABELS[lead.status],
			SOURCE_LABELS[lead.source],
			dateFormatter.format(new Date(lead.createdAt)),
		]),
	];
}
