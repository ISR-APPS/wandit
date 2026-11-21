// Holds sample records for the Housecall screens.
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
		name: "Marta Vale Quartet",
		subtitle: "Main hall",
		status: "Confirmed",
		value: "Tonight",
	},
	{
		name: "Small Hours Sunday",
		subtitle: "Studio B",
		status: "Confirmed",
		value: "18 Oct",
	},
	{
		name: "Open Rooms Showcase",
		subtitle: "Main hall",
		status: "Hold",
		value: "23 Oct",
	},
	{
		name: "Irving Autumn Benefit",
		subtitle: "Main hall",
		status: "Confirmed",
		value: "24 Oct",
	},
	{
		name: "North End Listening Club",
		subtitle: "Studio B",
		status: "Hold",
		value: "28 Oct",
	},
];

/** The records in the second workspace view. */
export const secondaryRows: readonly WorkspaceRow[] = [
	{
		name: "Load in",
		subtitle: "Stage crew · West entrance",
		status: "Ready",
		value: "16:30",
	},
	{
		name: "Soundcheck",
		subtitle: "Audio crew · Main hall",
		status: "Ready",
		value: "17:45",
	},
	{
		name: "Doors",
		subtitle: "Front of house · Lobby",
		status: "Upcoming",
		value: "19:00",
	},
	{
		name: "First set",
		subtitle: "Show team · Main hall",
		status: "Upcoming",
		value: "20:00",
	},
	{
		name: "Load out",
		subtitle: "Stage crew · West entrance",
		status: "Upcoming",
		value: "22:50",
	},
];
