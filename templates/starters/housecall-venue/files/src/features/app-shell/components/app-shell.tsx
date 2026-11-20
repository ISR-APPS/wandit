// Renders the Housecall workspace around the signed-in route.
// The app route gives this shell the account email and the active page.
import {
	BroadcastIcon,
	CalendarBlankIcon,
	ListIcon,
	TicketIcon,
	UserCircleIcon,
	UsersThreeIcon,
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
	{ to: "/app", title: "Tonight", Icon: CalendarBlankIcon },
	{ to: "/app/workbench", title: "Bookings", Icon: TicketIcon },
	{ to: "/app/activity", title: "Crew call", Icon: UsersThreeIcon },
	{ to: "/app/profile", title: "Profile", Icon: UserCircleIcon },
] as const;

type AppShellProps = {
	/** Email of the signed-in account from the app route. */
	email: string;
	/** Active child of the app route. */
	children: ReactNode;
};

/** Keeps the account actions available when a narrow screen uses the menu sheet. */
export function AppShell({ email, children }: AppShellProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	return (
		<SidebarProvider
			className="flex-col bg-canvas lg:flex-row lg:gap-3 lg:p-4"
			data-surface="app"
		>
			<aside className="sticky top-4 hidden h-[calc(100svh-2rem)] w-56 shrink-0 flex-col rounded-2xl border bg-sidebar p-3 text-sidebar-foreground shadow-surface lg:flex">
				<Link
					to="/app"
					className="flex items-center gap-3 rounded-xl bg-sidebar-primary px-3 py-3 text-sidebar-primary-foreground"
				>
					<BroadcastIcon className="size-6 shrink-0" />
					<span>
						<span className="block font-display font-semibold">Housecall</span>
						<span className="block text-xs opacity-90">Irving Assembly</span>
					</span>
				</Link>
				<nav aria-label="Workspace" className="mt-7 grid gap-1">
					{destinations.slice(0, -1).map(({ to, title, Icon }) => (
						<Link
							key={to}
							to={to}
							activeOptions={{ exact: true }}
							className="flex items-center gap-3 rounded-full px-3 py-2.5 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground"
						>
							<Icon className="size-4 shrink-0" />
							{title}
						</Link>
					))}
				</nav>
				<div className="mt-auto rounded-xl bg-sidebar-accent p-3">
					<p className="font-display font-semibold">Main hall</p>
					<p className="text-sidebar-accent-foreground/80 text-sm">
						Doors 19:00
					</p>
				</div>
				<Link
					to="/app/profile"
					className="mt-2 flex items-center gap-3 rounded-full px-3 py-3 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent"
				>
					<UserCircleIcon className="size-5" />
					Profile
				</Link>
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
								<SheetTitle>Housecall</SheetTitle>
								<SheetDescription>Venue operations</SheetDescription>
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
							Venue operations
						</span>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<LocaleSwitcher />
						<NavUser email={email} placement="header" />
					</div>
				</header>
				<main className="min-w-0 flex-1 rounded-2xl bg-background p-5 md:p-8">
					{children}
				</main>
			</div>
		</SidebarProvider>
	);
}
