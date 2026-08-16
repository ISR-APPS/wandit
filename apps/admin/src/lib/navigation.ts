import type { Icon } from "@phosphor-icons/react";
import { BuildingsIcon } from "@phosphor-icons/react/Buildings";
import { ChartLineUpIcon } from "@phosphor-icons/react/ChartLineUp";
import { ChatCenteredDotsIcon } from "@phosphor-icons/react/ChatCenteredDots";
import { CoinsIcon } from "@phosphor-icons/react/Coins";
import { CurrencyDollarIcon } from "@phosphor-icons/react/CurrencyDollar";
import { FunnelIcon } from "@phosphor-icons/react/Funnel";
import { GearSixIcon } from "@phosphor-icons/react/GearSix";
import { GraduationCapIcon } from "@phosphor-icons/react/GraduationCap";
import { HeartStraightIcon } from "@phosphor-icons/react/HeartStraight";
import { LinkSimpleIcon } from "@phosphor-icons/react/LinkSimple";
import { MegaphoneIcon } from "@phosphor-icons/react/Megaphone";
import { PulseIcon } from "@phosphor-icons/react/Pulse";
import { ShareNetworkIcon } from "@phosphor-icons/react/ShareNetwork";
import { UsersFourIcon } from "@phosphor-icons/react/UsersFour";
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree";

export type AdminRoutePath =
	| "/dashboard"
	| "/users"
	| "/organizations"
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
	},
	{
		title: "Users",
		description: "Access and billing",
		to: "/users",
		icon: UsersThreeIcon,
	},
	{
		title: "Organizations",
		description: "Teams and credit pools",
		to: "/organizations",
		icon: BuildingsIcon,
	},
	{
		title: "Feedback",
		description: "Reports and requests",
		to: "/feedback",
		icon: ChatCenteredDotsIcon,
	},
	{
		title: "Affiliates",
		description: "Codes and attribution",
		to: "/affiliates",
		icon: ShareNetworkIcon,
	},
	{
		title: "Links",
		description: "Story links and traffic",
		to: "/links",
		icon: LinkSimpleIcon,
	},
	{
		title: "Costs",
		description: "Monthly spend inputs",
		to: "/costs",
		icon: CurrencyDollarIcon,
	},
	{
		title: "Academy",
		description: "Guides and tutorials",
		to: "/academy",
		icon: GraduationCapIcon,
	},
	{
		title: "Settings",
		description: "Product controls",
		to: "/settings",
		icon: GearSixIcon,
	},
];

const analyticsNavigation: AdminNavigationItem[] = [
	{
		title: "Revenue",
		description: "Revenue and conversion",
		to: "/analytics/revenue",
		icon: ChartLineUpIcon,
	},
	{
		title: "Acquisition",
		description: "Sources and campaigns",
		to: "/analytics/acquisition",
		icon: MegaphoneIcon,
	},
	{
		title: "Funnel",
		description: "Signup-to-paid journey",
		to: "/analytics/funnel",
		icon: FunnelIcon,
	},
	{
		title: "Engagement",
		description: "Activity and retention",
		to: "/analytics/engagement",
		icon: UsersFourIcon,
	},
	{
		title: "Features & Credits",
		description: "Adoption and credit use",
		to: "/analytics/features",
		icon: CoinsIcon,
	},
	{
		title: "Health",
		description: "Generation reliability",
		to: "/analytics/health",
		icon: HeartStraightIcon,
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
