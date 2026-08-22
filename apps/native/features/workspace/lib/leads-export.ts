// CSV export for the Leads view: build the same spreadsheet the web tab
// downloads, write it to the cache directory, and hand it to the OS share
// sheet (the phone's `<a download>`).

import { type Lead, serializeLeadOrderDetails } from "@wandit/contracts";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

// Capture-only metadata column header; deliberately the web's exact constant
// so both platforms' exports stay byte-compatible.
const ORDER_DETAILS_LABEL = "Order details";

/**
 * Same column set and escaping as the web export. The status label is
 * localized by the caller (dynamic `leads.status.<enum>` keys don't typecheck
 * through the native `t`).
 */
export function buildLeadsCsv(
	leads: Lead[],
	headers: readonly string[],
	statusLabel: (lead: Lead) => string,
): string {
	// CSV cells containing commas, quotes, or newlines must be wrapped in
	// quotes; doubled quotes are the CSV escape sequence for a literal quote.
	const escapeCell = (cell: string) =>
		/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
	const csvHeaders = [...headers, ORDER_DETAILS_LABEL]
		.map(escapeCell)
		.join(",");
	const rows = leads.map((lead) =>
		[
			lead.name,
			lead.phone,
			lead.wilaya ?? "",
			lead.commune ?? "",
			statusLabel(lead),
			lead.source,
			lead.campaign ?? "",
			lead.createdAt,
			serializeLeadOrderDetails(lead.extras),
		]
			.map(escapeCell)
			.join(","),
	);
	// The BOM makes Excel detect UTF-8, so Arabic names survive a double-click.
	return `\uFEFF${[csvHeaders, ...rows].join("\n")}`;
}

/** Write the CSV into the cache and open the OS share sheet on it. */
export async function shareLeadsCsv(
	filename: string,
	csv: string,
): Promise<void> {
	const directory = new Directory(Paths.cache, "leads-export");
	directory.create({ idempotent: true, intermediates: true });
	const file = new File(directory, filename);
	file.write(csv);

	try {
		await Sharing.shareAsync(file.uri, {
			dialogTitle: filename,
			mimeType: "text/csv",
		});
	} catch {
		// Expo Sharing cannot distinguish dismissal from other share termination.
	}
}
