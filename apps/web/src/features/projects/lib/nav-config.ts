// Typed sidebar nav config for the dashboard shell. AFFILIATE_NAV_GROUP stays
// separate from the always-visible groups because AppSidebar only adds it after
// the signed-in user is confirmed to have a linked affiliate profile.

import {
	Blocks,
	ChartSpline,
	FolderOpen,
	GraduationCap,
	Handshake,
	Images,
	type LucideIcon,
	Users,
} from "lucide-react";

import type { TranslationKey } from "@/lib/i18n";

export type NavAction = "open-support-chat";

type NavItemBase = {
	titleKey: TranslationKey;
	icon: LucideIcon;
};

export type NavRoutePath =
	| "/dashboard"
	| "/leads"
	| "/assets"
	| "/academy"
	| "/affiliates";

export type NavItem = NavItemBase &
	(
		| { type: "route"; to: NavRoutePath }
		| { type: "external"; href: string }
		// In-app action rather than navigation (e.g. open the support chat).
		| { type: "action"; action: NavAction }
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
			// "Build Your App" has no page yet: it is a disabled placeholder
			// with the "Soon" badge, like Analytics.
			{ type: "soon", titleKey: "projects.nav.buildApp", icon: Blocks },
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
		],
	},
];

export const AFFILIATE_NAV_GROUP: NavGroup = {
	titleKey: "affiliates.sidebarGroup",
	items: [
		{
			type: "route",
			titleKey: "affiliates.navLabel",
			to: "/affiliates",
			icon: Handshake,
		},
	],
};
