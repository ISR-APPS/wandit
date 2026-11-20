// Sets the navigation and page frame for Range Dispatch.
// The protected app route gives the frame a session email and the current page.
import {
	ArrowBendUpRightIcon,
	CrosshairIcon,
	MapTrifoldIcon,
	TruckIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useT } from "~/shared/i18n";
import { SidebarProvider } from "~/shared/ui/sidebar";
import { NavUser } from "./nav-user";

type AppShellProps = {
	/** Email from the Supabase session. The user menu shows this address. */
	email: string;
	/** The content from the current TanStack child route. */
	children: ReactNode;
};

/** Holds the app navigation and the session menu on each protected page. */
export function AppShell({ email, children }: AppShellProps) {
	const { t } = useT();
	return (
		<SidebarProvider className="flex-col md:flex-row" data-surface="app">
			<aside className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-sidebar-border border-b bg-sidebar p-3 text-sidebar-foreground md:top-4 md:m-4 md:me-0 md:h-[calc(100svh-2rem)] md:w-60 md:flex-col md:items-stretch md:rounded-2xl md:border md:p-4">
				<Link
					to="/app"
					className="flex items-center gap-3 rounded-lg md:mb-6 md:p-2"
				>
					<span className="grid size-10 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
						<CrosshairIcon size="22" />
					</span>
					<span>
						<strong className="block font-display">
							{t("common.appName")}
						</strong>
						<span className="block text-xs opacity-75">
							{t("dashboard.serviceOperations")}
						</span>
					</span>
				</Link>
				<nav
					aria-label={t("dashboard.dispatchNavigation")}
					className="flex flex-wrap gap-1 md:flex-1 md:flex-col"
				>
					<span className="hidden px-3 pb-2 text-xs opacity-70 md:block">
						{t("dashboard.workspaces")}
					</span>
					<Link
						to="/app"
						hash=""
						activeOptions={{ exact: true, includeHash: true }}
						className="flex items-center gap-3 rounded-nav px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground [&>svg]:size-5"
					>
						<MapTrifoldIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.dispatchMap")}</span>
					</Link>
					<Link
						to="/app"
						hash="service-calls"
						activeOptions={{ exact: true, includeHash: true }}
						className="flex items-center gap-3 rounded-nav px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground [&>svg]:size-5"
					>
						<ArrowBendUpRightIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.serviceCalls")}</span>
					</Link>
					<Link
						to="/app"
						hash="coverage"
						activeOptions={{ exact: true, includeHash: true }}
						className="flex items-center gap-3 rounded-nav px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground [&>svg]:size-5"
					>
						<TruckIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.crewCoverage")}</span>
					</Link>
				</nav>
				<div className="hidden gap-1 rounded-lg border border-sidebar-border p-3 md:grid">
					<span className="text-xs opacity-75">
						{t("dashboard.todaySShift")}
					</span>
					<strong className="font-display text-lg">08:00–17:00</strong>
					<span className="text-xs opacity-75">
						{t("dashboard.allCrewsCheckedIn")}
					</span>
				</div>
				<div className="flex items-center justify-between gap-2 md:border-sidebar-border md:border-t md:pt-3">
					<Link
						to="/app/profile"
						className="rounded-nav px-2 py-1 text-sm hover:underline"
					>
						{t("shell.profile")}
					</Link>
					<NavUser email={email} placement="header" />
				</div>
			</aside>
			<main className="min-w-0 flex-1 px-4 py-6 md:p-8">{children}</main>
		</SidebarProvider>
	);
}
