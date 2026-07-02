// Typed sidebar nav config for the dashboard shell. Only "Projects" is a
// real route today; the rest are disabled placeholders ("Soon") or external
// resource stubs.

import {
	BookOpen,
	ChartSpline,
	FolderOpen,
	Images,
	LifeBuoy,
	type LucideIcon,
	Users,
} from "lucide-react";

import { PROJECTS_COPY } from "./constants";

type NavItemBase = {
	title: string;
	icon: LucideIcon;
};

export type NavItem = NavItemBase &
	(
		| { type: "route"; to: "/dashboard" }
		| { type: "external"; href: string }
		| { type: "soon" }
	);

export type NavGroup = {
	title: string;
	items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
	{
		title: PROJECTS_COPY.sidebarGroupWorkspace,
		items: [
			{ type: "route", title: "Projects", to: "/dashboard", icon: FolderOpen },
			{ type: "soon", title: "Leads", icon: Users },
			{ type: "soon", title: "Assets", icon: Images },
			{ type: "soon", title: "Analytics", icon: ChartSpline },
		],
	},
	{
		title: PROJECTS_COPY.sidebarGroupResources,
		items: [
			{ type: "external", title: "Docs", href: "#", icon: BookOpen },
			{ type: "external", title: "Support", href: "#", icon: LifeBuoy },
		],
	},
];
