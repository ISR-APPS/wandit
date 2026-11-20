// Holds sample records for the Rushes screens.
// The dashboard and the workspace lists read the same records.

/** One row of sample data. The last field is display text in its domain unit. */
export type WorkspaceRow = {
	name: string;
	/** Owner, location, or context shown under the record name. */
	subtitle: string;
	status: string;
	/** Value shown in the end column. The domain sets its unit. */
	value: string;
};

/** The main queue on the overview and the workbench. */
export const primaryRows: readonly WorkspaceRow[] = [
	{
		name: "18B · Take 04",
		subtitle: "Kitchen window · Camera A",
		status: "Select",
		value: "00:42",
	},
	{
		name: "18B · Take 02",
		subtitle: "Kitchen window · Camera B",
		status: "To review",
		value: "00:37",
	},
	{
		name: "22A · Take 03",
		subtitle: "Front gate wide · Camera A",
		status: "Select",
		value: "01:14",
	},
	{
		name: "19C · Take 01",
		subtitle: "Landing detail · Camera A",
		status: "Hold",
		value: "00:16",
	},
	{
		name: "22A · Take 04",
		subtitle: "Front gate wide · Camera B",
		status: "To review",
		value: "01:21",
	},
];

/** The records in the second workspace view. */
export const secondaryRows: readonly WorkspaceRow[] = [
	{
		name: "Hold the pause at the window",
		subtitle: "18B · Iris Chen",
		status: "Open",
		value: "00:21",
	},
	{
		name: "Check focus after gate opens",
		subtitle: "22A · Arlo Reed",
		status: "Open",
		value: "00:49",
	},
	{
		name: "Use boom recording",
		subtitle: "18B · Nora Bell",
		status: "Resolved",
		value: "00:17",
	},
];
