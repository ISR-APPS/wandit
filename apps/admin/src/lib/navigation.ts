import type { Icon } from "@phosphor-icons/react";
import { PulseIcon } from "@phosphor-icons/react/Pulse";
import { ShareNetworkIcon } from "@phosphor-icons/react/ShareNetwork";
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree";

export type AdminRoutePath = "/dashboard" | "/users" | "/affiliates";

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
		title: "Affiliates",
		description: "Codes and attribution",
		to: "/affiliates",
		icon: ShareNetworkIcon,
	},
];
