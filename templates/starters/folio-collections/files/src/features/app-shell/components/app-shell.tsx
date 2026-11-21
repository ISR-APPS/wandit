// Sets the navigation and page frame for Folio Collections.
// The protected app route gives the frame a session email and the current page.
import {
	ArchiveIcon,
	CirclesThreePlusIcon,
	IdentificationBadgeIcon,
	StackIcon,
	TagIcon,
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
			<aside className="flex shrink-0 flex-wrap items-center border-sidebar-border border-b bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-svh md:w-67 md:flex-nowrap md:items-stretch md:border-e md:border-b-0">
				<div className="flex w-full items-center justify-between gap-1 border-sidebar-border border-b p-2 md:w-15 md:flex-col md:border-e md:border-b-0 md:py-5">
					<Link
						to="/app"
						aria-label={t("common.appName")}
						className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"
					>
						<CirclesThreePlusIcon size="23" />
					</Link>
					<div className="flex gap-3 md:flex-1 md:flex-col md:pt-7">
						<Link
							to="/app"
							aria-label={t("dashboard.collections")}
							className="rounded-nav p-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
						>
							<ArchiveIcon size="19" />
						</Link>
						<Link
							to="/app/profile"
							aria-label={t("shell.profile")}
							className="rounded-nav p-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
						>
							<IdentificationBadgeIcon size="19" />
						</Link>
					</div>
					<NavUser userId={userId} email={email} placement="header" />
				</div>
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-4 px-4 py-3 md:flex-col md:items-stretch md:py-7">
					<h2 className="font-display text-2xl leading-none">
						{t("common.appName")}
					</h2>
					<nav
						aria-label={t("dashboard.collectionDirectory")}
						className="flex flex-wrap gap-3 md:mt-5 md:flex-1 md:flex-col md:gap-0"
					>
						<Link
							to="/app"
							hash=""
							activeOptions={{ exact: true, includeHash: true }}
							className="flex items-center gap-2 border-b px-0.5 py-2.5 text-sm hover:text-primary data-[status=active]:border-primary data-[status=active]:text-primary [&>svg]:size-4"
						>
							<ArchiveIcon aria-hidden="true" />{" "}
							<span>{t("dashboard.collectionOverview")}</span>
						</Link>
						<Link
							to="/app"
							hash="objects"
							activeOptions={{ exact: true, includeHash: true }}
							className="flex items-center gap-2 border-b px-0.5 py-2.5 text-sm hover:text-primary data-[status=active]:border-primary data-[status=active]:text-primary [&>svg]:size-4"
						>
							<StackIcon aria-hidden="true" />{" "}
							<span>{t("dashboard.objectRegister")}</span>
						</Link>
						<Link
							to="/app"
							hash="loans"
							activeOptions={{ exact: true, includeHash: true }}
							className="flex items-center gap-2 border-b px-0.5 py-2.5 text-sm hover:text-primary data-[status=active]:border-primary data-[status=active]:text-primary [&>svg]:size-4"
						>
							<TagIcon aria-hidden="true" />{" "}
							<span>{t("dashboard.loanRegister")}</span>
						</Link>
					</nav>
					<span className="hidden text-muted-foreground text-xs md:block">
						{t("dashboard.curatorialOffice")}
					</span>
				</div>
			</aside>
			<main className="min-w-0 flex-1 p-4 md:p-8 xl:p-12">{children}</main>
		</SidebarProvider>
	);
}
