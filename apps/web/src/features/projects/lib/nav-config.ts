// Typed sidebar nav config for the dashboard shell. Only "Projects" is a
// real route today; the rest are disabled placeholders ("Soon") or external
// resource stubs. Titles are dictionary keys, resolved at render.

import {
	BookOpen,
	ChartSpline,
	FolderOpen,
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

export type NavItem = NavItemBase &
	(
		| { type: "route"; to: "/dashboard" }
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
			{ type: "soon", titleKey: "projects.nav.leads", icon: Users },
			{ type: "soon", titleKey: "projects.nav.assets", icon: Images },
			{ type: "soon", titleKey: "projects.nav.analytics", icon: ChartSpline },
		],
	},
	{
		titleKey: "projects.sidebar.groupResources",
		items: [
			// Docs/support sites don't exist yet — "Soon" until they do, so the
			// launch video doesn't show dead "#" links.
			{ type: "soon", titleKey: "projects.nav.docs", icon: BookOpen },
			{ type: "soon", titleKey: "projects.nav.support", icon: LifeBuoy },
		],
	},
];
