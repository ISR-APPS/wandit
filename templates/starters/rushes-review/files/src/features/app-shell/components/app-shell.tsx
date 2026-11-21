// Renders the Rushes workspace around the signed-in route.
// The app route gives this shell the account email and the active page.
import {
	ChatsCircleIcon,
	FilmReelIcon,
	FilmSlateIcon,
	FilmStripIcon,
	ListIcon,
	UserCircleIcon,
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
	{ to: "/app", title: "Dailies", Icon: FilmSlateIcon },
	{ to: "/app/workbench", title: "Takes", Icon: FilmStripIcon },
	{ to: "/app/activity", title: "Review notes", Icon: ChatsCircleIcon },
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
			<aside className="sticky top-0 hidden h-svh shrink-0 border-sidebar-border border-e bg-sidebar text-sidebar-foreground lg:flex">
				<nav
					aria-label="Workspace"
					className="flex w-16 flex-col items-center gap-2 border-sidebar-border border-e pt-4"
				>
					<Link
						to="/app"
						aria-label="Rushes"
						className="mb-5 grid size-10 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
					>
						<FilmReelIcon className="size-6" />
					</Link>
					{destinations.map(({ to, title, Icon }) => (
						<Link
							key={to}
							to={to}
							title={title}
							aria-label={title}
							activeOptions={{ exact: true }}
							className="grid size-10 place-items-center rounded-lg hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary"
						>
							<Icon className="size-6" />
						</Link>
					))}
				</nav>
				<div className="hidden w-40 flex-col p-4 xl:flex">
					<p className="font-display font-semibold text-lg">Palmetto</p>
					<p className="mb-5 text-sidebar-foreground/70 text-xs">
						Unit A / Day 07
					</p>
					<ul
						aria-label="Scenes in this delivery"
						className="divide-y border-sidebar-border border-y text-sm"
					>
						<li className="py-2">Kitchen window</li>
						<li className="py-2">Landing detail</li>
						<li className="py-2">Front gate wide</li>
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
								<SheetTitle>Rushes</SheetTitle>
								<SheetDescription>Picture review</SheetDescription>
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
						<span className="truncate font-medium text-sm">Picture review</span>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<LocaleSwitcher />
						<NavUser userId={userId} email={email} placement="header" />
					</div>
				</header>
				<main className="min-w-0 flex-1 border-t p-5 md:p-8">{children}</main>
			</div>
		</SidebarProvider>
	);
}
