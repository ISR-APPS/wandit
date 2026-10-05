// The frame of every page behind login: the sidebar, the header bar, and the page area.
// The /app layout route renders it around its child routes.
// The page area is a container (@container/main), so page grids react to its width, not the window.
import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "~/shared/ui/sidebar";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

type AppShellProps = {
	/** Email of the signed-in user, from the session of the /app layout route. */
	email: string;
	/** The page of the current child route. */
	children: ReactNode;
};

/** Sidebar plus page column. The template has no data-density attribute, so the density is regular. */
export function AppShell({ email, children }: AppShellProps) {
	return (
		<SidebarProvider>
			<AppSidebar email={email} />
			<SidebarInset>
				<AppHeader />
				<main className="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
					{children}
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
