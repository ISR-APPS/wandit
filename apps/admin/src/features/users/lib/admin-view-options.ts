import { defaultSupportViews } from "@wandit/auth/admin-permissions";
import type { AdminUserRole, AdminView } from "@wandit/contracts";

export const ADMIN_VIEW_LABELS = {
	overview: {
		label: "Overview",
		description: "Platform pulse",
	},
	users: {
		label: "Users",
		description: "Access and billing",
	},
	organizations: {
		label: "Organizations",
		description: "Teams and credit pools",
	},
	billing: {
		label: "Offline billing",
		description: "Cash & transfer requests",
	},
	publications: {
		label: "Publications",
		description: "Latest published websites",
	},
	feedback: {
		label: "Feedback",
		description: "Reports and requests",
	},
	affiliates: {
		label: "Affiliates",
		description: "Codes and attribution",
	},
	links: {
		label: "Links",
		description: "Story links and traffic",
	},
	costs: {
		label: "Costs",
		description: "Monthly spend inputs",
	},
	academy: {
		label: "Academy",
		description: "Guides and tutorials",
	},
	analytics: {
		label: "Analytics",
		description: "Revenue, acquisition, engagement, and health",
	},
	conversations: {
		label: "Conversations",
		description: "Customer chats and AI failures",
	},
	settings: {
		label: "Settings",
		description: "Product controls",
	},
} as const satisfies Record<AdminView, { label: string; description: string }>;

export function getInitialAdminViews(
	role: AdminUserRole,
	storedViews: readonly AdminView[] | null | undefined,
): AdminView[] {
	if (role === "support" && storedViews !== null && storedViews !== undefined) {
		return [...storedViews];
	}

	return [...defaultSupportViews];
}

export function hasAtLeastOneAdminView(views: readonly AdminView[]): boolean {
	return views.length > 0;
}
