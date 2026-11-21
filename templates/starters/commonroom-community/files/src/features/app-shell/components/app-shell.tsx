// Renders the Commonroom workspace around the signed-in route.
// The app route gives this shell the account email and the active page.
import {
	ChatsTeardropIcon,
	HashIcon,
	ListIcon,
	PlantIcon,
	SquaresFourIcon,
	UserCircleIcon,
	UsersIcon,
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
	{ to: "/app", title: "Community pulse", Icon: SquaresFourIcon },
	{ to: "/app/workbench", title: "Conversations", Icon: ChatsTeardropIcon },
	{ to: "/app/activity", title: "Member directory", Icon: UsersIcon },
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
		<SidebarProvider className="flex-col lg:flex-row" data-surface="app">
			<aside className="sticky top-0 hidden h-svh w-72 shrink-0 flex-col bg-sidebar px-5 py-7 text-sidebar-foreground lg:flex">
				<Link
					to="/app"
					className="flex items-center gap-3 rounded-xl bg-sidebar-accent p-3"
				>
					<span className="grid size-11 place-items-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
						<PlantIcon className="size-6" />
					</span>
					<span>
						<span className="block font-display font-semibold text-lg">
							The Maker Room
						</span>
						<span className="block text-sidebar-foreground/80 text-xs">
							Commonroom
						</span>
					</span>
				</Link>
				<nav aria-label="Workspace" className="mt-6 grid gap-1">
					{destinations.map(({ to, title, Icon }) => (
						<Link
							key={to}
							to={to}
							activeOptions={{ exact: true }}
							className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:font-semibold"
						>
							<Icon className="size-5 shrink-0" />
							{title}
						</Link>
					))}
				</nav>
				<div className="mt-6 border-sidebar-border border-t pt-4">
					<p className="px-3 font-semibold text-sidebar-foreground/80 text-xs">
						Channels
					</p>
					<ul
						aria-label="Community channels"
						className="mt-2 grid gap-1 text-sm"
					>
						{["Studio chat", "Ask for help", "Introductions"].map((channel) => (
							<li
								key={channel}
								className="flex items-center gap-2 px-3 py-2 text-sidebar-foreground/80"
							>
								<HashIcon className="size-4" />
								{channel}
							</li>
						))}
					</ul>
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
								<SheetTitle>Commonroom</SheetTitle>
								<SheetDescription>Member space</SheetDescription>
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
						<span className="truncate font-medium text-sm">Member space</span>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<LocaleSwitcher />
						<NavUser email={email} placement="header" />
					</div>
				</header>
				<main className="min-w-0 flex-1 border-t p-5 md:p-9">{children}</main>
			</div>
		</SidebarProvider>
	);
}
