// CSV export for the Leads view: build the same spreadsheet the web tab
// downloads, write it to the cache directory, and hand it to the OS share
// sheet (the phone's `<a download>`).

import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

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
