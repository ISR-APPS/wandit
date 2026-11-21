// Sets the navigation and page frame for Sentry Access.
// The protected app route gives the frame a session email and the current page.
import {
	FingerprintIcon,
	GitBranchIcon,
	ShieldCheckIcon,
	WarningOctagonIcon,
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
			<aside className="z-10 flex shrink-0 flex-wrap items-center gap-4 border-sidebar-border border-b bg-sidebar p-4 text-sidebar-foreground md:sticky md:top-0 md:h-svh md:w-64 md:flex-col md:items-stretch md:border-e md:border-b-0 md:p-3">
				<Link
					to="/app"
					className="flex items-center gap-3 border border-sidebar-border p-3"
				>
					<FingerprintIcon size="24" className="text-primary" />
					<strong className="font-mono text-sm">{t("common.appName")}</strong>
				</Link>
				<nav
					aria-label={t("dashboard.identityNavigation")}
					className="flex flex-wrap gap-1 font-mono md:mt-6 md:flex-1 md:flex-col"
				>
					<span className="hidden px-3 text-muted-foreground text-xs md:block">
						{t("dashboard.reviewsProduction")}
					</span>
					<Link
						to="/app"
						hash=""
						activeOptions={{ exact: true, includeHash: true }}
						className="flex items-center gap-2 border-transparent border-s px-3 py-2 text-xs hover:bg-muted data-[status=active]:border-primary data-[status=active]:bg-primary/10 data-[status=active]:text-primary [&>svg]:size-4"
					>
						<ShieldCheckIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.reviewSummary")}</span>
					</Link>
					<div className="flex gap-1 md:ms-4 md:flex-col md:border-s">
						<Link
							to="/app"
							hash="sources"
							activeOptions={{ exact: true, includeHash: true }}
							className="flex items-center gap-2 border-transparent border-s px-3 py-2 text-xs hover:bg-muted data-[status=active]:border-primary data-[status=active]:bg-primary/10 data-[status=active]:text-primary [&>svg]:size-4"
						>
							<GitBranchIcon aria-hidden="true" />{" "}
							<span>{t("dashboard.identitySources")}</span>
						</Link>
						<Link
							to="/app"
							hash="exceptions"
							activeOptions={{ exact: true, includeHash: true }}
							className="flex items-center gap-2 border-transparent border-s px-3 py-2 text-xs hover:bg-muted data-[status=active]:border-primary data-[status=active]:bg-primary/10 data-[status=active]:text-primary [&>svg]:size-4"
						>
							<WarningOctagonIcon aria-hidden="true" />{" "}
							<span>{t("dashboard.accessExceptions")}</span>
						</Link>
					</div>
				</nav>
				<div className="flex items-center justify-between gap-2 md:border-t md:pt-3">
					<Link
						to="/app/profile"
						className="rounded-nav px-2 py-1 text-sm hover:underline"
					>
						{t("shell.profile")}
					</Link>
					<NavUser email={email} placement="header" />
				</div>
			</aside>
			<div className="min-w-0 flex-1">
				<header className="flex items-center justify-between gap-2 border-b px-4 py-3 font-mono text-muted-foreground text-xs md:px-7">
					<span>{t("dashboard.auditWorkspaceQ3Cycle")}</span>
					<span className="text-success">{t("dashboard.snapshotLoaded")}</span>
				</header>
				<main className="p-4 md:p-7">{children}</main>
			</div>
		</SidebarProvider>
	);
}
