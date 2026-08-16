// Typed sidebar nav config for the dashboard shell. Leads, Assets, Apps and Academy
// are real routes; Analytics and the support link stay as disabled
// placeholders ("Soon"). Titles are dictionary keys, resolved at render.

import {
	Blocks,
	ChartSpline,
	FolderOpen,
	GraduationCap,
	Images,
	LifeBuoy,
	type LucideIcon,
	Users,
} from "lucide-react";

import type { TranslationKey } from "@/lib/i18n";

type NavItemBase = {
	titleKey: TranslationKey;
	icon: LucideIcon;
};

export type NavRoutePath =
	| "/dashboard"
	| "/leads"
	| "/assets"
	| "/apps"
	| "/academy";

export type NavItem = NavItemBase &
	(
		| { type: "route"; to: NavRoutePath }
		| { type: "external"; href: string }
		| { type: "soon" }
	);

export type NavGroup = {
	titleKey: TranslationKey;
	items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
	{
		titleKey: "projects.sidebar.groupWorkspace",
		items: [
			{
				type: "route",
				titleKey: "projects.nav.projects",
				to: "/dashboard",
				icon: FolderOpen,
			},
			{
				type: "route",
				titleKey: "projects.nav.leads",
				to: "/leads",
				icon: Users,
			},
			{
				type: "route",
				titleKey: "projects.nav.assets",
				to: "/assets",
				icon: Images,
			},
			{ type: "soon", titleKey: "projects.nav.analytics", icon: ChartSpline },
			{
				type: "route",
				titleKey: "projects.nav.apps",
				to: "/apps",
				icon: Blocks,
			},
		],
	},
	{
		titleKey: "projects.sidebar.groupResources",
		items: [
			{
				type: "route",
				titleKey: "academy.navLabel",
				to: "/academy",
				icon: GraduationCap,
			},
			// The support site doesn't exist yet — "Soon" until it does, so the
			// launch video doesn't show dead "#" links.
			{ type: "soon", titleKey: "projects.nav.support", icon: LifeBuoy },
		],
	},
];
