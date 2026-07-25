export const notifications = [
	{
		id: "review-access",
		title: "Access review is ready",
		description: "Three administrator roles are waiting for review.",
		date: "8 minutes ago",
		initials: "AR",
		unread: true,
	},
	{
		id: "usage-threshold",
		title: "Usage threshold reached",
		description: "One workspace crossed 80% of its monthly token allowance.",
		date: "42 minutes ago",
		initials: "UT",
		unread: true,
	},
	{
		id: "new-accounts",
		title: "New account activity",
		description: "Seventeen users joined the platform since yesterday.",
		date: "2 hours ago",
		initials: "NA",
		unread: false,
	},
	{
		id: "export-finished",
		title: "Usage export finished",
		description: "The July token-consumption report is ready to download.",
		date: "Yesterday",
		initials: "UE",
		unread: false,
	},
] as const;

export type Notification = (typeof notifications)[number];
