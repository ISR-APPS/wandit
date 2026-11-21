// Renders the Gridwatch workspace around the signed-in route.
// The app route gives this shell the account email and the active page.
import {
	GaugeIcon,
	ListIcon,
	PulseIcon,
	UserCircleIcon,
	WarningOctagonIcon,
	WaveformIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { LocaleSwitcher } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
	SheetTrigger,
} from "~/shared/ui/sheet";
import { SidebarProvider } from "~/shared/ui/sidebar";
import { NavUser } from "./nav-user";

const destinations = [
	{ to: "/app", title: "Overview", Icon: PulseIcon },
	{ to: "/app/workbench", title: "Meters", Icon: GaugeIcon },
	{ to: "/app/activity", title: "Events", Icon: WarningOctagonIcon },
	{ to: "/app/profile", title: "Profile", Icon: UserCircleIcon },
] as const;

type AppShellProps = {
	/** `auth.users.id` of the signed-in user, from the session of the /app layout route. The user menu reads its `app_access` row. */
	userId: string;
	/** Email of the signed-in account from the app route. */
	email: string;
	/** Active child of the app route. */
	children: ReactNode;
};

/** Keeps the account actions available when a narrow screen uses the menu sheet. */
export function AppShell({ userId, email, children }: AppShellProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	return (
		<SidebarProvider className="flex-col lg:flex-row" data-surface="app">
			<aside className="sticky top-0 hidden h-svh w-52 shrink-0 flex-col border-sidebar-border border-e bg-sidebar text-sidebar-foreground lg:flex">
				<Link
					to="/app"
					className="flex items-center gap-2 border-sidebar-border border-b px-4 py-5 font-display font-semibold text-sm"
				>
					<WaveformIcon className="size-5 text-sidebar-primary" />
					Gridwatch
				</Link>
				<p className="px-4 pt-4 font-numeric text-sidebar-foreground/70 text-xs">
					Microgrid 04
				</p>
				<nav aria-label="Workspace" className="mt-3 grid gap-0.5 px-2">
					{destinations.map(({ to, title, Icon }) => (
						<Link
							key={to}
							to={to}
							activeOptions={{ exact: true }}
							className="flex items-center gap-2 border-transparent border-s px-2 py-2 font-numeric text-sm hover:text-sidebar-primary data-[status=active]:border-sidebar-primary data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary"
						>
							<Icon className="size-4" />
							{title}
						</Link>
					))}
				</nav>
				<div className="mt-auto border-sidebar-border border-t px-4 py-3 font-numeric text-xs">
					<span className="flex items-center gap-2">
						<span
							className="size-2 rounded-full bg-success"
							aria-hidden="true"
						/>
						11 / 12 feeds online
					</span>
				</div>
			</aside>
			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex min-h-14 items-center justify-between gap-3 bg-background px-5 md:px-8">
					<div className="flex min-w-0 items-center gap-3">
						<Sheet open={menuOpen} onOpenChange={setMenuOpen}>
							<SheetTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									className="shrink-0 lg:hidden"
									aria-label="Open navigation"
								>
									<ListIcon />
								</Button>
							</SheetTrigger>
							<SheetContent side="start" className="p-4">
								<SheetTitle>Gridwatch</SheetTitle>
								<SheetDescription>Site telemetry</SheetDescription>
								<nav aria-label="Workspace" className="grid gap-2">
									{destinations.map(({ to, title, Icon }) => (
										<Link
											key={to}
											to={to}
											activeOptions={{ exact: true }}
											onClick={() => setMenuOpen(false)}
											className="flex items-center gap-2 rounded-md p-2 hover:bg-accent data-[status=active]:bg-accent"
										>
											<Icon className="size-5" />
											{title}
										</Link>
									))}
								</nav>
							</SheetContent>
						</Sheet>
						<span className="truncate font-medium text-sm">Site telemetry</span>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<LocaleSwitcher />
						<NavUser userId={userId} email={email} placement="header" />
					</div>
				</header>
				<main className="min-w-0 flex-1 border-t p-5 md:p-7">{children}</main>
			</div>
		</SidebarProvider>
	);
}
