// Holds sample records for the Commonroom screens.
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
		name: "Show your Friday workbench",
		subtitle: "Studio chat · Tessa Mori",
		status: "Active",
		value: "28 replies",
	},
	{
		name: "A better way to label spare parts?",
		subtitle: "Ask for help · Nilo Rose",
		status: "Needs reply",
		value: "2 hours",
	},
	{
		name: "October reading shelf",
		subtitle: "Open talk · Imane Ho",
		status: "Active",
		value: "11 replies",
	},
	{
		name: "First laser-cut enclosure",
		subtitle: "Introductions · Samir Bell",
		status: "Needs reply",
		value: "4 hours",
	},
	{
		name: "Where to source offcuts locally",
		subtitle: "Ask for help · Lin Dara",
		status: "Active",
		value: "8 replies",
	},
];

/** The records in the second workspace view. */
export const secondaryRows: readonly WorkspaceRow[] = [
	{
		name: "Tessa Mori",
		subtitle: "Woodworking",
		status: "Host",
		value: "Joined May",
	},
	{
		name: "Nilo Rose",
		subtitle: "Electronics",
		status: "Member",
		value: "Joined Oct",
	},
	{
		name: "Imane Ho",
		subtitle: "Printmaking",
		status: "Host",
		value: "Joined June",
	},
	{
		name: "Samir Bell",
		subtitle: "Industrial design",
		status: "New",
		value: "Joined Oct",
	},
];
