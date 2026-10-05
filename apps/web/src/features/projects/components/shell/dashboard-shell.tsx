/**
 * The frame of the dashboard pages: the floating sidebar and the top bar
 * around the page content. The dashboard, leads, assets, academy, and
 * affiliates pages render it.
 */
import { SidebarInset, SidebarProvider } from "@wandit/ui/components/sidebar";
import type * as React from "react";

import type { TranslationKey } from "@/lib/i18n";
import { AppSidebar } from "./app-sidebar";
import { DashboardHeader } from "./dashboard-header";

/** `titleKey` is the page title in the top bar. Each page renders its own shell. */
export function DashboardShell({
	children,
	titleKey,
}: {
	children: React.ReactNode;
	titleKey?: TranslationKey;
}) {
	return (
		<SidebarProvider
			style={
				{
					"--sidebar-width": "16rem",
					// Collapsed, the card holds one 40 px circle per link and 8 px of padding on each side.
					"--sidebar-width-icon": "3.5rem",
				} as React.CSSProperties
			}
		>
			<AppSidebar variant="floating" collapsible="icon" />
			<SidebarInset>
				<DashboardHeader titleKey={titleKey} />
				<div className="flex flex-1 flex-col">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
