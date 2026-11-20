// Holds sample records for the Supply Index screens.
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
		name: "PO-1087 · Assembly fixtures",
		subtitle: "Lathe & Co.",
		status: "Awaiting approval",
		value: "$12,080",
	},
	{
		name: "PO-1083 · Cable glands",
		subtitle: "Radwell Parts",
		status: "Ordered",
		value: "$4,110",
	},
	{
		name: "PO-1079 · Tool drawers",
		subtitle: "Tanner Works",
		status: "Delivered",
		value: "$8,400",
	},
	{
		name: "PO-1077 · Mailer stock",
		subtitle: "Union Paper",
		status: "Ordered",
		value: "$2,740",
	},
	{
		name: "PO-1072 · Lab storage",
		subtitle: "Tanner Works",
		status: "Awaiting approval",
		value: "$3,990",
	},
];

/** The records in the second workspace view. */
export const secondaryRows: readonly WorkspaceRow[] = [
	{
		name: "Lathe & Co.",
		subtitle: "Fixture machining",
		status: "Active",
		value: "Net 30",
	},
	{
		name: "Radwell Parts",
		subtitle: "Electrical components",
		status: "Active",
		value: "Net 45",
	},
	{
		name: "Tanner Works",
		subtitle: "General equipment",
		status: "Active",
		value: "Net 30",
	},
	{
		name: "Union Paper",
		subtitle: "Packing supplies",
		status: "Review",
		value: "Net 15",
	},
];
