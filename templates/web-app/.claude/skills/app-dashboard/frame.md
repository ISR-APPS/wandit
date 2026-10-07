# Frame

The template ships shell=inset, density=regular, and mode=light.
Apply one section per axis of your recipe: mode, shell, density. The style file can fix each of them.
The style owns the sidebar colors and the panels, through its palette tokens and its knobs.

- The frame files are in `src/features/app-shell/components/`. Do not edit `src/shared/ui/sidebar.tsx`.

## Mode

### mode=light

No change. `<html>` has no class, and `src/shared/ui/sonner.tsx` keeps `theme="light"`.
After an earlier dark build, remove `className="dark"` from `<html>`. In `sonner.tsx`, set `theme="light"`,
with this comment line above it: `// The app sets no dark class, so a dark OS must not darken the toasts.`

### mode=dark

1. In `src/routes/__root.tsx`, add the class to `<html>`: `<html lang={locale} dir={dir} className="dark">`.
2. In `src/shared/ui/sonner.tsx`, set `theme="dark"`. Change the two comment lines above it to:
   `// The app sets the dark class on <html>, so the toasts are dark too.`

The public pages are dark too. Radix menus render in `body`, so the class must be on `<html>`.

## Shell

Two props of `<Sidebar>` in `app-sidebar.tsx` set the shell. shell=rail also edits `app-shell.tsx`.
shell=topbar replaces four files. Every `SidebarMenuButton` keeps its `tooltip`.

### shell=inset

No change: `<Sidebar label={appName} variant="inset" collapsible="icon">`.

### shell=floating

`<Sidebar label={appName} variant="floating" collapsible="offcanvas">`.

### shell=bordered

`<Sidebar label={appName} variant="sidebar" collapsible="offcanvas">`.

### shell=rail

`<Sidebar label={appName} variant="sidebar" collapsible="icon">`.
In `app-shell.tsx`: `<SidebarProvider defaultOpen={false}>`. The sidebar starts as icons, and the trigger opens it.

### shell=topbar

The header spans the full width above the sidebar. The app name and the user menu move to the header.
Replace these four files. The user menu becomes an avatar button.

#### File: src/features/app-shell/components/app-shell.tsx

```tsx
// The frame of every page behind login, topbar shell: a full-width header, then the sidebar and the page.
// The /app layout route renders it around its child routes.
// The page area is a container (@container/main), so page grids react to its width, not the window.
import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "~/shared/ui/sidebar";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

type AppShellProps = {
	/** Email of the signed-in user, from the session of the /app layout route. */
	email: string;
	/** The page of the current child route. */
	children: ReactNode;
};

/** Header on top, sidebar and page below. --header-height puts the fixed sidebar under the header. */
export function AppShell({ email, children }: AppShellProps) {
	return (
		<SidebarProvider className="flex-col [--header-height:3.5rem]">
			<AppHeader email={email} />
			<div className="flex flex-1">
				<AppSidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" />
				<SidebarInset>
					<main className="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
						{children}
					</main>
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
```

#### File: src/features/app-shell/components/app-header.tsx

```tsx
// The top bar of the topbar shell: sidebar trigger, app name, page name, language switcher, and user menu.
// AppShell renders it above the sidebar and the page.
// The page name comes from the active NAV_ITEMS entry.
import { Link, useMatchRoute } from "@tanstack/react-router";
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { Separator } from "~/shared/ui/separator";
import { SidebarTrigger } from "~/shared/ui/sidebar";
import { findActiveNavItem } from "../lib/nav-items";
import { NavUser } from "./nav-user";

type AppHeaderProps = {
	/** Email of the signed-in user, from the session of the /app layout route. */
	email: string;
};

/** Sticky bar, --header-height high. It shows no page name on a page that NAV_ITEMS does not list. */
export function AppHeader({ email }: AppHeaderProps) {
	const { t } = useT();
	const activeItem = findActiveNavItem(useMatchRoute());
	const appName = t("common.appName");

	return (
		<header className="sticky top-0 z-20 flex h-(--header-height) w-full shrink-0 items-center gap-2 border-b bg-background px-4">
			<SidebarTrigger className="-ms-1" aria-label={t("shell.toggleSidebar")} />
			<Link
				to="/app"
				className="flex min-w-0 items-center gap-2 font-display font-semibold"
			>
				<span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
					{appName.charAt(0)}
				</span>
				<span className="hidden truncate sm:inline">{appName}</span>
			</Link>
			{activeItem ? (
				<>
					<Separator
						orientation="vertical"
						className="mx-2 data-[orientation=vertical]:h-4"
					/>
					<span className="truncate text-muted-foreground text-sm">
						{t(activeItem.labelKey)}
					</span>
				</>
			) : null}
			<div className="ms-auto flex items-center gap-2">
				{/* An internal tool has no landing page, so this is its language switcher. It renders nothing for one language. */}
				<LocaleSwitcher />
				<NavUser email={email} />
			</div>
		</header>
	);
}
```

#### File: src/features/app-shell/components/nav-user.tsx

```tsx
// The user menu of the topbar shell: an avatar button, and a menu with the email and Sign out.
// AppHeader renders it at the end of the bar. Sign-out uses the auth feature mutation.
// On success, that mutation opens / and clears the query cache.

import { LogOutIcon } from "lucide-react";
import { toast } from "sonner";
import { useSignOutMutation } from "~/features/auth";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";

type NavUserProps = {
	/** Email of the signed-in user, from the session of the /app layout route. */
	email: string;
};

/** The avatar button. A failed sign-out shows a toast; a success leaves the app area. */
export function NavUser({ email }: NavUserProps) {
	const { t } = useT();
	const signOut = useSignOutMutation();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				{/* The email names the button for screen readers. The initials alone say little. */}
				<Button variant="ghost" size="icon" aria-label={email}>
					<Avatar>
						<AvatarFallback className="font-medium text-xs">
							{email.slice(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel
					dir="auto"
					className="truncate font-normal text-muted-foreground"
				>
					{email}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					disabled={signOut.isPending}
					onSelect={() =>
						signOut.mutate(undefined, {
							onError: () => toast.error(t("shell.signOutError")),
						})
					}
				>
					<LogOutIcon className="rtl:rotate-180" />
					{t("common.signOut")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
```

#### File: src/features/app-shell/components/app-sidebar.tsx

```tsx
// The sidebar of the area behind login, topbar shell: the nav items only.
// AppShell renders it under the header. The header holds the app name and the user menu.
// It marks the NAV_ITEMS entry of the current route. Colors come only from the sidebar tokens.
import { Link, useMatchRoute } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "~/shared/ui/sidebar";
import { findActiveNavItem, NAV_ITEMS } from "../lib/nav-items";

type AppSidebarProps = {
	/** Classes of the fixed sidebar column. AppShell uses them to put the column under the header. */
	className?: string;
};

/** Each nav click also closes the mobile Sheet. */
export function AppSidebar({ className }: AppSidebarProps) {
	const { t } = useT();
	const { setOpenMobile } = useSidebar();
	const activeItem = findActiveNavItem(useMatchRoute());

	return (
		// shell=topbar: a plain column under the header. It collapses to icons, so the nav stays in view.
		<Sidebar
			label={t("common.appName")}
			variant="sidebar"
			collapsible="icon"
			className={className}
		>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu>
						{NAV_ITEMS.map((item) => {
							const label = t(item.labelKey);
							return (
								<SidebarMenuItem key={item.to}>
									<SidebarMenuButton
										asChild
										isActive={item === activeItem}
										tooltip={label}
									>
										<Link to={item.to} onClick={() => setOpenMobile(false)}>
											<item.icon />
											<span>{label}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							);
						})}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
```

## Density

`tokens.css` maps the attribute to `--spacing` and `--text-sm`. Menus and dialogs render outside the shell,
so they keep the regular density.

### density=compact

In `app-shell.tsx`: `<SidebarInset data-density="compact">`.

### density=regular

No change: `<SidebarInset>` has no `data-density`.

### density=comfortable

In `app-shell.tsx`: `<SidebarInset data-density="comfortable">`.
