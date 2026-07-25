import { createFileRoute, Outlet } from "@tanstack/react-router";
import type { CSSProperties } from "react";

import { SiteHeader } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const shellVariables = {
	"--sidebar-width": "15.5rem",
	"--header-height": "calc(var(--spacing) * 14)",
	"--content-padding": "calc(var(--spacing) * 4)",
	"--content-margin": "calc(var(--spacing) * 1.5)",
	"--content-full-height":
		"calc(100dvh - var(--header-height) - (var(--content-padding) * 2) - (var(--content-margin) * 2))",
} as CSSProperties;

function getDefaultSidebarState() {
	return !document.cookie
		.split("; ")
		.some((cookie) => cookie === "wandit_admin_sidebar_state=false");
}

export const Route = createFileRoute("/_dashboard")({
	component: DashboardShell,
});

function DashboardShell() {
	return (
		<SidebarProvider
			defaultOpen={getDefaultSidebarState()}
			style={shellVariables}
		>
			<AppSidebar variant="inset" />
			<SidebarInset>
				<SiteHeader />
				<main className="flex flex-1 flex-col bg-muted/40">
					<div className="@container/main p-(--content-padding) xl:group-data-[theme-content-layout=centered]/layout:container xl:group-data-[theme-content-layout=centered]/layout:mx-auto">
						<Outlet />
					</div>
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
