import type { Icon } from "@phosphor-icons/react";
import { ChatCenteredDotsIcon } from "@phosphor-icons/react/ChatCenteredDots";
import { GearSixIcon } from "@phosphor-icons/react/GearSix";
import { PulseIcon } from "@phosphor-icons/react/Pulse";
import { ShareNetworkIcon } from "@phosphor-icons/react/ShareNetwork";
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree";

export type AdminRoutePath =
	| "/dashboard"
	| "/users"
	| "/feedback"
	| "/affiliates"
	| "/settings";

export type AdminNavigationItem = {
	title: string;
	description: string;
	to: AdminRoutePath;
	icon: Icon;
};

export const adminNavigation: AdminNavigationItem[] = [
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
		title: "Settings",
		description: "Product controls",
		to: "/settings",
		icon: GearSixIcon,
	},
];
