// Renders the Editline workspace around the signed-in route.
// The app route gives this shell the account email and the active page.
import {
	ClockCounterClockwiseIcon,
	ListIcon,
	NewspaperIcon,
	NotePencilIcon,
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
	{ to: "/app", title: "Run of show", Icon: NewspaperIcon },
	{ to: "/app/workbench", title: "Story desk", Icon: NotePencilIcon },
	{
		to: "/app/activity",
		title: "Edition log",
		Icon: ClockCounterClockwiseIcon,
	},
	{ to: "/app/profile", title: "Profile", Icon: UserCircleIcon },
] as const;
const home = { to: "/app", activeOptions: { exact: true } } as const;

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
			<aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-e bg-sidebar px-6 py-8 text-sidebar-foreground lg:flex">
				<Link
					to="/app"
					className="border-sidebar-border border-b pb-5 font-display font-semibold text-4xl"
				>
					Editline.
				</Link>
				<p className="pt-5 text-muted-foreground text-xs">The morning desk</p>
				<nav
					aria-label="Workspace"
					className="mt-5 grid border-sidebar-border border-y text-sm"
				>
					<Link
						{...home}
						className="border-sidebar-border border-b py-4 hover:text-sidebar-primary data-[status=active]:font-semibold data-[status=active]:text-sidebar-primary"
					>
						Run of show
					</Link>
					<Link
						to="/app/workbench"
						className="border-sidebar-border border-b py-4 hover:text-sidebar-primary data-[status=active]:font-semibold data-[status=active]:text-sidebar-primary"
					>
						Story desk
					</Link>
					<Link
						to="/app/activity"
						className="py-4 hover:text-sidebar-primary data-[status=active]:font-semibold data-[status=active]:text-sidebar-primary"
					>
						Edition log
					</Link>
				</nav>
				<div className="mt-10 border-sidebar-primary border-s ps-3">
					<span className="text-muted-foreground text-xs">Today’s edition</span>
					<p className="font-display text-xl">Evening print</p>
				</div>
				<Link
					to="/app/profile"
					className="mt-auto flex items-center gap-2 text-sm hover:text-sidebar-primary data-[status=active]:text-sidebar-primary"
				>
					<UserCircleIcon className="size-4" />
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
								<SheetTitle>Editline</SheetTitle>
								<SheetDescription>Editorial workspace</SheetDescription>
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
							Editorial workspace
						</span>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<LocaleSwitcher />
						<NavUser userId={userId} email={email} placement="header" />
					</div>
				</header>
				<main className="min-w-0 flex-1 border-t p-5 md:p-8 lg:px-12">
					{children}
				</main>
			</div>
		</SidebarProvider>
	);
}
