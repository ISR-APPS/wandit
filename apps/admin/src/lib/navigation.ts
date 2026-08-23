import type { Icon } from "@phosphor-icons/react";
import { BuildingsIcon } from "@phosphor-icons/react/Buildings";
import { ChartLineUpIcon } from "@phosphor-icons/react/ChartLineUp";
import { ChatCenteredDotsIcon } from "@phosphor-icons/react/ChatCenteredDots";
import { CoinsIcon } from "@phosphor-icons/react/Coins";
import { CurrencyDollarIcon } from "@phosphor-icons/react/CurrencyDollar";
import { FunnelIcon } from "@phosphor-icons/react/Funnel";
import { GearSixIcon } from "@phosphor-icons/react/GearSix";
import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { GraduationCapIcon } from "@phosphor-icons/react/GraduationCap";
import { HandCoinsIcon } from "@phosphor-icons/react/HandCoins";
import { HeartStraightIcon } from "@phosphor-icons/react/HeartStraight";
import { LinkSimpleIcon } from "@phosphor-icons/react/LinkSimple";
import { MegaphoneIcon } from "@phosphor-icons/react/Megaphone";
import { PulseIcon } from "@phosphor-icons/react/Pulse";
import { ShareNetworkIcon } from "@phosphor-icons/react/ShareNetwork";
import { UsersFourIcon } from "@phosphor-icons/react/UsersFour";
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree";
import type { AdminPermissionRequest } from "@wandit/auth/admin-permissions";
import { adminRoleHasPermission } from "@wandit/auth/admin-permissions";

export type AdminRoutePath =
	| "/dashboard"
	| "/users"
	| "/organizations"
	| "/offline-billing"
	| "/publications"
	| "/feedback"
	| "/affiliates"
	| "/links"
	| "/costs"
	| "/academy"
	| "/analytics/revenue"
	| "/analytics/acquisition"
	| "/analytics/funnel"
	| "/analytics/engagement"
	| "/analytics/features"
	| "/analytics/health"
	| "/settings";

export type AdminNavigationItem = {
	title: string;
	description: string;
	to: AdminRoutePath;
	icon: Icon;
	permission: AdminPermissionRequest;
};

export type AdminNavigationGroup = {
	title: string;
	items: AdminNavigationItem[];
};

const operationsNavigation: AdminNavigationItem[] = [
	{
		title: "Overview",
		description: "Platform pulse",
		to: "/dashboard",
		icon: PulseIcon,
		permission: { overview: ["read"] },
	},
	{
		title: "Users",
		description: "Access and billing",
		to: "/users",
		icon: UsersThreeIcon,
		permission: { users: ["read"] },
	},
	{
		title: "Organizations",
		description: "Teams and credit pools",
		to: "/organizations",
		icon: BuildingsIcon,
		permission: { organizations: ["read"] },
	},
	{
		title: "Offline billing",
		description: "Cash & transfer requests",
		to: "/offline-billing",
		icon: HandCoinsIcon,
		permission: { billing: ["read"] },
	},
	{
		title: "Publications",
		description: "Latest published websites",
		to: "/publications",
		icon: GlobeIcon,
		permission: { publications: ["read"] },
	},
	{
		title: "Feedback",
		description: "Reports and requests",
		to: "/feedback",
		icon: ChatCenteredDotsIcon,
		permission: { feedback: ["read"] },
	},
	{
		title: "Affiliates",
		description: "Codes and attribution",
		to: "/affiliates",
		icon: ShareNetworkIcon,
		permission: { affiliates: ["read"] },
	},
	{
		title: "Links",
		description: "Story links and traffic",
		to: "/links",
		icon: LinkSimpleIcon,
		permission: { links: ["read"] },
	},
	{
		title: "Costs",
		description: "Monthly spend inputs",
		to: "/costs",
		icon: CurrencyDollarIcon,
		permission: { costs: ["read"] },
	},
	{
		title: "Academy",
		description: "Guides and tutorials",
		to: "/academy",
		icon: GraduationCapIcon,
		permission: { academy: ["read"] },
	},
	{
		title: "Settings",
		description: "Product controls",
		to: "/settings",
		icon: GearSixIcon,
		permission: { settings: ["read"] },
	},
];

const analyticsNavigation: AdminNavigationItem[] = [
	{
		title: "Revenue",
		description: "Revenue and conversion",
		to: "/analytics/revenue",
		icon: ChartLineUpIcon,
		permission: { analytics: ["read"] },
	},
	{
		title: "Acquisition",
		description: "Sources and campaigns",
		to: "/analytics/acquisition",
		icon: MegaphoneIcon,
		permission: { analytics: ["read"] },
	},
	{
		title: "Funnel",
		description: "Signup-to-paid journey",
		to: "/analytics/funnel",
		icon: FunnelIcon,
		permission: { analytics: ["read"] },
	},
	{
		title: "Engagement",
		description: "Activity and retention",
		to: "/analytics/engagement",
		icon: UsersFourIcon,
		permission: { analytics: ["read"] },
	},
	{
		title: "Features & Credits",
		description: "Adoption and credit use",
		to: "/analytics/features",
		icon: CoinsIcon,
		permission: { analytics: ["read"] },
	},
	{
		title: "Health",
		description: "Generation reliability",
		to: "/analytics/health",
		icon: HeartStraightIcon,
		permission: { analytics: ["read"] },
	},
];

export const adminNavigationGroups: AdminNavigationGroup[] = [
	{
		title: "Operations",
		items: operationsNavigation,
	},
	{
		title: "Analytics",
		items: analyticsNavigation,
	},
];

export const adminNavigation = adminNavigationGroups.flatMap(
	(group) => group.items,
);

export function getVisibleAdminNavigationGroups(
	role: string | null | undefined,
): AdminNavigationGroup[] {
	return adminNavigationGroups.flatMap((group) => {
		const items = group.items.filter((item) =>
			adminRoleHasPermission(role, item.permission),
		);

		return items.length > 0 ? [{ ...group, items }] : [];
	});
}

export function getVisibleAdminNavigation(
	role: string | null | undefined,
): AdminNavigationItem[] {
	return getVisibleAdminNavigationGroups(role).flatMap((group) => group.items);
}
