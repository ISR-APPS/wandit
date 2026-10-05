// Typed sidebar nav config for the dashboard shell. AFFILIATE_NAV_GROUP stays
// separate from the always-visible groups because AppSidebar only adds it after
// the signed-in user is confirmed to have a linked affiliate profile.

import type { Icon } from "@phosphor-icons/react";
import { ChartLineUpIcon } from "@phosphor-icons/react/ChartLineUp";
import { ChatCircleDotsIcon } from "@phosphor-icons/react/ChatCircleDots";
import { DeviceMobileIcon } from "@phosphor-icons/react/DeviceMobile";
import { GraduationCapIcon } from "@phosphor-icons/react/GraduationCap";
import { HandshakeIcon } from "@phosphor-icons/react/Handshake";
import { ImagesSquareIcon } from "@phosphor-icons/react/ImagesSquare";
import { SquaresFourIcon } from "@phosphor-icons/react/SquaresFour";
import { TrayIcon } from "@phosphor-icons/react/Tray";

import type { TranslationKey } from "@/lib/i18n";

/** What an action link does. AppSidebar maps each value to a handler. */
export type NavAction = "open-support-chat" | "send-feedback";

type NavItemBase = {
	titleKey: TranslationKey;
	/** A Phosphor icon. AppSidebar picks the weight: fill when active, duotone when idle. */
	icon: Icon;
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
		// In-app action rather than navigation (e.g. open the feedback dialog).
		| { type: "action"; action: NavAction }
		| { type: "soon" }
	);

export type NavGroup = {
	titleKey: TranslationKey;
	items: NavItem[];
};

/** The links of the dashboard sidebar, in display order. AppSidebar renders one group per entry. */
export const NAV_GROUPS: NavGroup[] = [
	{
		titleKey: "projects.sidebar.groupWorkspace",
		items: [
			{
				type: "route",
				titleKey: "projects.nav.projects",
				to: "/dashboard",
				// A grid of app tiles, like a phone home screen: each project is an app.
				icon: SquaresFourIcon,
			},
			{
				type: "route",
				titleKey: "projects.nav.leads",
				to: "/leads",
				// Every order that the projects capture arrives here, like mail in a tray.
				icon: TrayIcon,
			},
			{
				type: "route",
				titleKey: "projects.nav.assets",
				to: "/assets",
				icon: ImagesSquareIcon,
			},
			{
				type: "soon",
				titleKey: "projects.nav.analytics",
				icon: ChartLineUpIcon,
			},
			// "Build Your App" has no page yet: it is a disabled placeholder
			// with the "Soon" badge, like Analytics.
			{
				type: "soon",
				titleKey: "projects.nav.buildApp",
				icon: DeviceMobileIcon,
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
				icon: GraduationCapIcon,
			},
			// The dialog opens over the current page, so the report keeps the page URL and screenshot.
			{
				type: "action",
				action: "send-feedback",
				titleKey: "common.feedback.open",
				icon: ChatCircleDotsIcon,
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
			icon: HandshakeIcon,
		},
	],
};
