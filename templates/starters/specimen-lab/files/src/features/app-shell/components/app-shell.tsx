// Sets the navigation and page frame for Specimen.
// The protected app route gives the frame a session email and the current page.
import {
	BarcodeIcon,
	FlaskIcon,
	ListChecksIcon,
	SignpostIcon,
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
			<aside className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-sidebar-border border-b bg-sidebar p-3 text-sidebar-foreground md:order-2 md:h-svh md:w-60 md:flex-col md:items-stretch md:justify-start md:border-s md:border-b-0 md:p-6">
				<Link to="/app" className="flex items-center gap-3 md:mb-9">
					<FlaskIcon size="26" className="text-sidebar-primary" />
					<strong className="font-display text-xl">
						{t("common.appName")}
					</strong>
				</Link>
				<nav
					aria-label={t("dashboard.sampleNavigation")}
					className="flex flex-wrap gap-1 md:flex-1 md:flex-col"
				>
					<h2 className="hidden px-3 pb-2 text-xs opacity-70 md:block">
						{t("dashboard.benchDirectory")}
					</h2>
					<Link
						to="/app"
						hash=""
						activeOptions={{ exact: true, includeHash: true }}
						className="flex items-center gap-3 rounded-nav border border-transparent px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:border-sidebar-border data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground [&>svg]:size-5"
					>
						<SignpostIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.intakeOverview")}</span>
					</Link>
					<Link
						to="/app"
						hash="register"
						activeOptions={{ exact: true, includeHash: true }}
						className="flex items-center gap-3 rounded-nav border border-transparent px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:border-sidebar-border data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground [&>svg]:size-5"
					>
						<BarcodeIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.sampleRegister")}</span>
					</Link>
					<Link
						to="/app"
						hash="benches"
						activeOptions={{ exact: true, includeHash: true }}
						className="flex items-center gap-3 rounded-nav border border-transparent px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:border-sidebar-border data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground [&>svg]:size-5"
					>
						<ListChecksIcon aria-hidden="true" />{" "}
						<span>{t("dashboard.processingBenches")}</span>
					</Link>
				</nav>
				<div className="hidden border-sidebar-border border-t py-3 font-numeric text-xs md:block">
					{t("dashboard.intakeDeskB02")}
				</div>
				<div className="flex items-center gap-2 md:justify-between">
					<Link
						to="/app/profile"
						className="rounded-nav px-2 py-1 text-sm hover:underline"
					>
						{t("shell.profile")}
					</Link>
					<NavUser email={email} placement="header" />
				</div>
			</aside>
			<div className="min-w-0 flex-1 md:order-1">
				<header className="border-b px-4 py-3 text-muted-foreground text-sm md:px-8">
					{t("dashboard.laboratoryOperationsSampleIntake")}
				</header>
				<main className="mx-auto max-w-[78rem] p-4 md:p-8">{children}</main>
			</div>
		</SidebarProvider>
	);
}
