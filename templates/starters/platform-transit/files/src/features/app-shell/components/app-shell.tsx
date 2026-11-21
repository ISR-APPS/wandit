// Renders the Platform workspace around the signed-in route.
// The app route gives this shell the account email and the active page.
import {
	ClockIcon,
	ListIcon,
	TrainIcon,
	UserCircleIcon,
	WarningCircleIcon,
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
	{ to: "/app", title: "Service board", Icon: TrainIcon },
	{ to: "/app/workbench", title: "Departures", Icon: ClockIcon },
	{ to: "/app/activity", title: "Disruptions", Icon: WarningCircleIcon },
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
		<SidebarProvider
			className="flex-col lg:flex-row-reverse"
			data-surface="app"
		>
			<aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-sidebar-border border-s bg-sidebar text-sidebar-foreground lg:flex">
				<Link
					to="/app"
					className="flex items-center gap-3 bg-sidebar-primary p-5 text-sidebar-primary-foreground"
				>
					<TrainIcon className="size-7 shrink-0" />
					<span>
						<span className="block font-display font-semibold text-xl">
							Platform
						</span>
						<span className="block text-xs opacity-90">Northline Transit</span>
					</span>
				</Link>
				<nav aria-label="Workspace" className="grid gap-0.5 px-3 pt-5">
					{destinations.map(({ to, title, Icon }) => (
						<Link
							key={to}
							to={to}
							activeOptions={{ exact: true }}
							className="flex items-center justify-between rounded-md px-3 py-3 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:font-semibold"
						>
							{title}
							<Icon className="size-5" />
						</Link>
					))}
				</nav>
				<div className="mx-5 mt-auto mb-6 border-sidebar-border border-t pt-4">
					<p className="font-semibold text-sm">North sector</p>
					<p className="mt-1 text-sidebar-foreground/80 text-xs">
						Morning service window
					</p>
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
								<SheetTitle>Platform</SheetTitle>
								<SheetDescription>Network control</SheetDescription>
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
						<span className="truncate font-medium text-sm">
							Network control
						</span>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<LocaleSwitcher />
						<NavUser userId={userId} email={email} placement="header" />
					</div>
				</header>
				<main className="min-w-0 flex-1 border-t p-5 md:p-9">{children}</main>
			</div>
		</SidebarProvider>
	);
}
