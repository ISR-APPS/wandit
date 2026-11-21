// Renders the Supply Index workspace around the signed-in route.
// The app route gives this shell the account email and the active page.
import {
	FactoryIcon,
	ListBulletsIcon,
	ListIcon,
	ReceiptIcon,
	StackIcon,
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
	{ to: "/app", title: "Register", Icon: ListBulletsIcon },
	{ to: "/app/workbench", title: "Purchase orders", Icon: ReceiptIcon },
	{ to: "/app/activity", title: "Suppliers", Icon: FactoryIcon },
	{ to: "/app/profile", title: "Profile", Icon: UserCircleIcon },
] as const;
const home = { to: "/app", activeOptions: { exact: true } } as const;

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
			<aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-sidebar-border border-e bg-sidebar text-sidebar-foreground lg:flex">
				<Link
					to="/app"
					className="flex items-center gap-2 border-sidebar-border border-b px-4 py-5 font-display font-semibold text-lg"
				>
					<StackIcon className="size-6" />
					Supply Index
				</Link>
				<nav aria-label="Workspace" className="grid gap-3 p-3">
					<Link
						{...home}
						className="flex items-center gap-2 rounded-md border border-transparent px-2 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:border-sidebar-primary data-[status=active]:font-semibold"
					>
						<ListBulletsIcon className="size-4" />
						Register
					</Link>
					<div className="ms-2 border-sidebar-border border-s ps-3">
						<p className="px-2 pb-2 text-sidebar-foreground/70 text-xs">
							Purchasing
						</p>
						<Link
							to="/app/workbench"
							className="flex items-center gap-2 rounded-md border border-transparent px-2 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:border-sidebar-primary data-[status=active]:font-semibold"
						>
							<ReceiptIcon className="size-4" />
							Purchase orders
						</Link>
						<Link
							to="/app/activity"
							className="flex items-center gap-2 rounded-md border border-transparent px-2 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:border-sidebar-primary data-[status=active]:font-semibold"
						>
							<FactoryIcon className="size-4" />
							Suppliers
						</Link>
					</div>
					<Link
						to="/app/profile"
						className="flex items-center gap-2 rounded-md border border-transparent px-2 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:border-sidebar-primary data-[status=active]:font-semibold"
					>
						<UserCircleIcon className="size-4" />
						Profile
					</Link>
				</nav>
				<p className="mt-auto border-sidebar-border border-t p-4 font-numeric text-sidebar-foreground/70 text-xs">
					Fiscal year 2026 / Q4
				</p>
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
								<SheetTitle>Supply Index</SheetTitle>
								<SheetDescription>Operations unit</SheetDescription>
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
							Operations unit
						</span>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<LocaleSwitcher />
						<NavUser email={email} placement="header" />
					</div>
				</header>
				<main className="min-w-0 flex-1 border-t p-5 md:p-7">{children}</main>
			</div>
		</SidebarProvider>
	);
}
