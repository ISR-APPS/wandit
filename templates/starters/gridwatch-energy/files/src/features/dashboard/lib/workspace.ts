// Holds sample records for the Gridwatch screens.
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
		name: "G-01 · Main feeder",
		subtitle: "Switch room 01",
		status: "Online",
		value: "108.6 kW",
	},
	{
		name: "G-02 · South roof PV",
		subtitle: "South roof",
		status: "Online",
		value: "36.1 kW",
	},
	{
		name: "G-03 · HVAC bank",
		subtitle: "Mechanical floor",
		status: "Online",
		value: "53.7 kW",
	},
	{
		name: "G-04 · North auxiliary",
		subtitle: "North service room",
		status: "Late",
		value: "—",
	},
	{
		name: "G-05 · Loading dock",
		subtitle: "West loading area",
		status: "Online",
		value: "19.6 kW",
	},
];

/** The records in the second workspace view. */
export const secondaryRows: readonly WorkspaceRow[] = [
	{
		name: "North meter reports late",
		subtitle: "G-04 · North service room",
		status: "Open",
		value: "14:32",
	},
	{
		name: "Daily demand peak",
		subtitle: "Main service",
		status: "Recorded",
		value: "14:10",
	},
	{
		name: "Solar output crosses 40 kW",
		subtitle: "South roof PV",
		status: "Recorded",
		value: "12:05",
	},
	{
		name: "Network check complete",
		subtitle: "Operations desk",
		status: "Recorded",
		value: "08:15",
	},
];
