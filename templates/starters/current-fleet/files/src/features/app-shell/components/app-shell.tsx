// Sets the navigation and page frame for Current Fleet.
// The protected app route gives the frame a session email and the current page.
import {
	BatteryChargingIcon,
	ChartLineUpIcon,
	LightningIcon,
	SquaresFourIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useT } from "~/shared/i18n";
import { SidebarProvider } from "~/shared/ui/sidebar";
import { NavUser } from "./nav-user";

type AppShellProps = {
	/** `auth.users.id` of the signed-in user, from the session of the /app layout route. The user menu reads its `app_access` row. */
	userId: string;
	/** Email from the Supabase session. The user menu shows this address. */
	email: string;
	/** The content from the current TanStack child route. */
	children: ReactNode;
};

/** Holds the app navigation and the session menu on each protected page. */
export function AppShell({ userId, email, children }: AppShellProps) {
	const { t } = useT();
	return (
		<SidebarProvider className="flex-col md:flex-row" data-surface="app">
			<aside className="fixed inset-x-0 bottom-0 z-10 flex shrink-0 items-center justify-around gap-1 border-sidebar-border border-t bg-sidebar p-1 text-sidebar-foreground md:sticky md:top-0 md:h-svh md:w-29 md:flex-col md:justify-start md:gap-4 md:border-e md:border-t-0 md:p-3">
				<Link
					to="/app"
					aria-label={t("common.appName")}
					className="grid size-10 place-items-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground md:size-14"
				>
					<LightningIcon size="25" />
				</Link>
				<nav
					aria-label={t("dashboard.fleetNavigation")}
					className="flex items-center gap-1 md:mt-4 md:flex-1 md:flex-col"
				>
					<Link
						to="/app"
						hash=""
						activeOptions={{ exact: true, includeHash: true }}
						className="flex flex-col items-center gap-1 gap-3 rounded-nav px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground [&>svg]:size-5"
					>
						<SquaresFourIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.depot")}</span>
					</Link>
					<Link
						to="/app"
						hash="bays"
						activeOptions={{ exact: true, includeHash: true }}
						className="flex flex-col items-center gap-1 gap-3 rounded-nav px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground [&>svg]:size-5"
					>
						<BatteryChargingIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.bays")}</span>
					</Link>
					<Link
						to="/app"
						hash="load"
						activeOptions={{ exact: true, includeHash: true }}
						className="flex flex-col items-center gap-1 gap-3 rounded-nav px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground [&>svg]:size-5"
					>
						<ChartLineUpIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.demand")}</span>
					</Link>
				</nav>
				<div className="flex items-center gap-2 md:flex-col">
					<Link
						to="/app/profile"
						className="rounded-nav px-2 py-1 text-sm hover:underline"
					>
						{t("shell.profile")}
					</Link>
					<NavUser userId={userId} email={email} placement="header" />
				</div>
			</aside>
			<div className="min-w-0 flex-1 pb-19 md:pb-0">
				<header className="flex items-center justify-between gap-2 border-b px-4 py-3 text-sm md:px-8">
					<span className="font-display font-semibold">
						{t("common.appName")}
					</span>
					<span className="rounded-full border bg-card px-3 py-1 text-xs">
						{t("dashboard.depotOperations")}
					</span>
				</header>
				<main className="mx-auto max-w-[88rem] p-4 md:p-8">{children}</main>
			</div>
		</SidebarProvider>
	);
}
