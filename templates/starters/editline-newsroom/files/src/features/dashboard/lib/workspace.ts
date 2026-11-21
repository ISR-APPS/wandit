// Holds sample records for the Editline screens.
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
		name: "A second life for the city’s empty lots",
		subtitle: "Metro desk · Lina Aziz",
		status: "In review",
		value: "10:15",
	},
	{
		name: "The week in five charts",
		subtitle: "Economy desk · Noor Ali",
		status: "Ready",
		value: "11:00",
	},
	{
		name: "The last independent bookbinders",
		subtitle: "Culture desk · Isaac Reyes",
		status: "In draft",
		value: "13:30",
	},
	{
		name: "What changes on the south line",
		subtitle: "Transit desk · Frances Okoye",
		status: "Ready",
		value: "14:00",
	},
	{
		name: "The new lease rules, explained",
		subtitle: "Service desk · Wafa Najjar",
		status: "In review",
		value: "15:15",
	},
];

/** The records in the second workspace view. */
export const secondaryRows: readonly WorkspaceRow[] = [
	{
		name: "Morning assignment huddle",
		subtitle: "Editorial calendar",
		status: "Complete",
		value: "08:30",
	},
	{
		name: "Fact check closes",
		subtitle: "Metro desk",
		status: "Upcoming",
		value: "12:45",
	},
	{
		name: "Homepage handover",
		subtitle: "Publishing desk",
		status: "Upcoming",
		value: "16:00",
	},
	{
		name: "Evening edition lock",
		subtitle: "All desks",
		status: "Upcoming",
		value: "17:30",
	},
];
