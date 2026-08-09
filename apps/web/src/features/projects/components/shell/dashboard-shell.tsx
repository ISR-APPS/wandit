import { SidebarInset, SidebarProvider } from "@wandit/ui/components/sidebar";
import type * as React from "react";

import type { TranslationKey } from "@/lib/i18n";
import { AppSidebar } from "./app-sidebar";
import { DashboardHeader } from "./dashboard-header";

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
					"--header-height": "3.5rem",
				} as React.CSSProperties
			}
		>
			<AppSidebar variant="inset" collapsible="icon" />
			<SidebarInset>
				<DashboardHeader titleKey={titleKey} />
				<div className="flex flex-1 flex-col">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
