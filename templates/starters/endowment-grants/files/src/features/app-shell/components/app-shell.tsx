// Sets the navigation and page frame for Endowment.
// The protected app route gives the frame a session email and the current page.
import {
	BookOpenIcon,
	CalendarCheckIcon,
	FileTextIcon,
	HandCoinsIcon,
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
			<aside className="z-10 flex shrink-0 flex-wrap items-center gap-4 border-sidebar-border border-b bg-sidebar p-4 text-sidebar-foreground md:sticky md:top-0 md:h-svh md:w-64 md:flex-col md:items-stretch md:border-e md:border-b-0 md:p-5">
				<Link
					to="/app"
					className="flex items-center gap-3 md:mt-4 md:flex-col md:items-start md:gap-5"
				>
					<BookOpenIcon size="30" className="text-sidebar-primary" />
					<strong className="font-display text-2xl">
						{t("common.appName")}
					</strong>
				</Link>
				<div className="hidden border-sidebar-border border-b pb-5 text-sm opacity-75 md:block">
					{t("dashboard.grantAdministration")}
				</div>
				<nav
					aria-label={t("dashboard.grantNavigation")}
					className="flex flex-wrap gap-1 md:mt-4 md:flex-1 md:flex-col"
				>
					<Link
						to="/app"
						hash=""
						activeOptions={{ exact: true, includeHash: true }}
						className="flex items-center gap-3 rounded-nav px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-background data-[status=active]:text-foreground md:-me-5 md:rounded-e-sm [&>svg]:size-5"
					>
						<CalendarCheckIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.currentCycle")}</span>
					</Link>
					<Link
						to="/app"
						hash="applications"
						activeOptions={{ exact: true, includeHash: true }}
						className="flex items-center gap-3 rounded-nav px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-background data-[status=active]:text-foreground md:-me-5 md:rounded-e-sm [&>svg]:size-5"
					>
						<FileTextIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.applications")}</span>
					</Link>
					<Link
						to="/app"
						hash="awards"
						activeOptions={{ exact: true, includeHash: true }}
						className="flex items-center gap-3 rounded-nav px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-background data-[status=active]:text-foreground md:-me-5 md:rounded-e-sm [&>svg]:size-5"
					>
						<HandCoinsIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.awardsLedger")}</span>
					</Link>
				</nav>
				<div className="flex items-center justify-between gap-2 md:pt-3">
					<Link
						to="/app/profile"
						className="rounded-nav px-2 py-1 text-sm hover:underline"
					>
						{t("shell.profile")}
					</Link>
					<NavUser email={email} placement="header" />
				</div>
			</aside>
			<main className="min-w-0 flex-1 p-4 md:p-10 xl:p-12">{children}</main>
		</SidebarProvider>
	);
}
