import { SidebarInset, SidebarProvider } from "@wandit/ui/components/sidebar";
import type * as React from "react";

import { AppSidebar } from "./app-sidebar";
import { DashboardHeader } from "./dashboard-header";

export function DashboardShell({ children }: { children: React.ReactNode }) {
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
				<DashboardHeader />
				<div className="flex flex-1 flex-col">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
