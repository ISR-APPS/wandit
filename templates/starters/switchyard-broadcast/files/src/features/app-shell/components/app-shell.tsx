// Sets the navigation and page frame for Switchyard.
// The protected app route gives the frame a session email and the current page.
import {
	BroadcastIcon,
	CalendarDotsIcon,
	MonitorIcon,
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
			<aside className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-sidebar-border border-b bg-sidebar p-2 text-sidebar-foreground md:h-svh md:w-24 md:flex-col md:border-e md:border-b-0">
				<Link
					to="/app"
					aria-label={t("common.appName")}
					className="grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground"
				>
					<BroadcastIcon size="25" />
				</Link>
				<nav
					aria-label={t("dashboard.studioNavigation")}
					className="flex gap-1 md:mt-12 md:w-full md:flex-1 md:flex-col"
				>
					<Link
						to="/app"
						hash=""
						activeOptions={{ exact: true, includeHash: true }}
						className="flex flex-col items-center justify-center gap-1 gap-3 rounded-nav px-2 px-3 py-2.5 text-sm text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground [&>svg]:size-5"
					>
						<BroadcastIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.live")}</span>
					</Link>
					<Link
						to="/app"
						hash="rundown"
						activeOptions={{ exact: true, includeHash: true }}
						className="flex flex-col items-center justify-center gap-1 gap-3 rounded-nav px-2 px-3 py-2.5 text-sm text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground [&>svg]:size-5"
					>
						<CalendarDotsIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.rundown")}</span>
					</Link>
					<Link
						to="/app"
						hash="channels"
						activeOptions={{ exact: true, includeHash: true }}
						className="flex flex-col items-center justify-center gap-1 gap-3 rounded-nav px-2 px-3 py-2.5 text-sm text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground [&>svg]:size-5"
					>
						<MonitorIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.channels")}</span>
					</Link>
				</nav>
				<div className="flex flex-col items-center gap-2">
					<Link
						to="/app/profile"
						className="rounded-nav px-2 py-1 text-sm hover:underline"
					>
						{t("shell.profile")}
					</Link>
					<NavUser userId={userId} email={email} placement="header" />
				</div>
			</aside>
			<div className="min-w-0 flex-1">
				<header className="flex min-h-14 items-center justify-between gap-3 border-b px-4 text-sm md:px-8">
					<span className="font-semibold">
						{t("common.appName")}{" "}
						<span className="ms-1 text-muted-foreground">
							/ {t("dashboard.mainControl")}
						</span>
					</span>
					<span className="flex items-center gap-2 text-success">
						<span className="size-2 rounded-full bg-success" />
						{t("dashboard.feedsHealthy")}
					</span>
				</header>
				<main className="mx-auto max-w-[88rem] p-4 md:p-8">{children}</main>
			</div>
		</SidebarProvider>
	);
}
