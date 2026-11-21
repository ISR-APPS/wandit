// Sets the navigation and page frame for Passline.
// The protected app route gives the frame a session email and the current page.
import {
	BellSimpleRingingIcon,
	CookingPotIcon,
	ForkKnifeIcon,
	TimerIcon,
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
		<SidebarProvider className="flex-col" data-surface="app">
			<div className="w-full">
				<header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background px-4 py-3 md:px-6">
					<Link
						to="/app"
						className="flex items-center gap-3 font-display font-semibold text-xl"
					>
						<ForkKnifeIcon size="23" className="text-primary" />
						{t("common.appName")}
					</Link>
					<div className="flex items-center gap-2">
						<span className="hidden rounded-full border border-primary/40 px-3 py-1 text-primary text-sm sm:inline">
							{t("dashboard.dinnerService")}
						</span>
						<div className="flex items-center gap-2">
							<Link
								to="/app/profile"
								className="rounded-nav px-2 py-1 text-sm hover:underline"
							>
								{t("shell.profile")}
							</Link>
							<NavUser email={email} placement="header" />
						</div>
					</div>
				</header>
				<div className="flex min-w-0 flex-col gap-3 p-3 md:flex-row md:gap-5 md:p-5">
					<aside className="shrink-0 rounded-2xl border-sidebar-border bg-sidebar p-3 text-sidebar-foreground md:sticky md:top-22 md:h-fit md:w-52 md:p-4">
						<p className="mb-2 px-3 text-xs opacity-70">
							{t("dashboard.kitchenStations")}
						</p>
						<nav
							aria-label={t("dashboard.serviceNavigation")}
							className="flex flex-wrap gap-2 md:flex-col"
						>
							<Link
								to="/app"
								hash=""
								activeOptions={{ exact: true, includeHash: true }}
								className="flex items-center gap-3 rounded-nav px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground [&>svg]:size-5"
							>
								<CookingPotIcon aria-hidden="true" />{" "}
								<span>{t("dashboard.ticketRail")}</span>
							</Link>
							<Link
								to="/app"
								hash="timing"
								activeOptions={{ exact: true, includeHash: true }}
								className="flex items-center gap-3 rounded-nav px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground [&>svg]:size-5"
							>
								<TimerIcon aria-hidden="true" />{" "}
								<span>{t("dashboard.courseTiming")}</span>
							</Link>
							<Link
								to="/app"
								hash="completed"
								activeOptions={{ exact: true, includeHash: true }}
								className="flex items-center gap-3 rounded-nav px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground [&>svg]:size-5"
							>
								<BellSimpleRingingIcon aria-hidden="true" />{" "}
								<span>{t("dashboard.completed")}</span>
							</Link>
						</nav>
					</aside>
					<main className="min-w-0 flex-1">{children}</main>
				</div>
			</div>
		</SidebarProvider>
	);
}
