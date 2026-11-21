// Holds sample records for the Platform screens.
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
		name: "Harbor local",
		subtitle: "H1 · Bay 3",
		status: "On time",
		value: "08:27",
	},
	{
		name: "Riverside express",
		subtitle: "R4 · Track 2",
		status: "Delayed",
		value: "08:31",
	},
	{
		name: "Midtown shuttle",
		subtitle: "M8 · Bay 5",
		status: "On time",
		value: "08:36",
	},
	{
		name: "Airport limited",
		subtitle: "A6 · Track 8",
		status: "Boarding",
		value: "08:42",
	},
	{
		name: "Harbor limited",
		subtitle: "H3 · Bay 2",
		status: "On time",
		value: "08:49",
	},
];

/** The records in the second workspace view. */
export const secondaryRows: readonly WorkspaceRow[] = [
	{
		name: "Riverside signal inspection",
		subtitle: "Pioneer to Riverside",
		status: "Active",
		value: "07:58",
	},
	{
		name: "Lift replacement",
		subtitle: "Midtown Central · North lift",
		status: "Scheduled",
		value: "10:10",
	},
	{
		name: "Platform closure",
		subtitle: "Harbor Pier · Track 4",
		status: "Cleared",
		value: "06:42",
	},
];
