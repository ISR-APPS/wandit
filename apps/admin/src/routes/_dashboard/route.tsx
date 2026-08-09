import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isAdminRole } from "@wandit/contracts";
import type { CSSProperties } from "react";

import { SiteHeader } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getSession } from "@/features/auth/lib/session";

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
	beforeLoad: async () => {
		const session = await getSession();

		if (!session) {
			throw redirect({ to: "/login" });
		}

		if (!isAdminRole(session.user.role)) {
			throw redirect({ to: "/login", search: { error: "forbidden" } });
		}
	},
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
