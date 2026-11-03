// The frame of every page behind login: the kit Sidebar (AppSidebar), the header, and the page column.
// The /app layout route renders it around its child routes. It reads the shell fields of theme.json from useAppTheme().
// Below 48rem the sidebar opens in the kit Sheet. The other axes of theme.json style the shell through engine.css.
// The page column is <main>. Its spacing uses the spacing scale, so the scale axis resizes it.
import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "~/shared/ui/sidebar";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { NavUser } from "./nav-user";

type AppShellProps = {
	/** Email of the signed-in user, from the session of the /app layout route. */
	email: string;
	/** The page of the current child route. */
	children: ReactNode;
};

type ThemeSelection = AppThemeFile["selection"];

/** The kit Sidebar variant of each sidebarStyle. "classic" is the kit "sidebar": a column with an edge rule. */
const SIDEBAR_VARIANTS = {
	inset: "inset",
	classic: "sidebar",
	floating: "floating",
} as const satisfies Record<ThemeSelection["sidebarStyle"], string>;

/** The kit collapsible mode of each sidebarCollapse: what the menu button does on a desktop. */
const SIDEBAR_COLLAPSIBLES = {
	icons: "icon",
	rail: "rail",
	offcanvas: "offcanvas",
} as const satisfies Record<ThemeSelection["sidebarCollapse"], string>;

/** The sidebar, then the page column. The other theme axes sit on <html> as data-* attributes. */
export function AppShell({ email, children }: AppShellProps) {
	const { sidebarStyle, sidebarCollapse, sidebarStart, userMenu } =
		useAppTheme().selection;

	return (
		// SidebarProvider reads defaultOpen once. The key remounts the shell when the builder changes a shell field live.
		// data-surface="app" gives the app display face to this area (engine.css).
		<SidebarProvider
			key={`${sidebarStyle}-${sidebarCollapse}-${sidebarStart}`}
			defaultOpen={sidebarStart === "open"}
			data-surface="app"
		>
			<AppSidebar
				email={email}
				variant={SIDEBAR_VARIANTS[sidebarStyle]}
				collapsible={SIDEBAR_COLLAPSIBLES[sidebarCollapse]}
				userMenu={userMenu}
			/>
			<SidebarInset>
				<AppHeader
					userMenu={
						userMenu === "header" ? (
							<NavUser email={email} placement="header" />
						) : null
					}
				/>
				<main className="flex flex-1 flex-col p-4 md:p-6">
					{/* --content-max is none on content=full and 72rem on centered. The max width sits on this column,
					    so main stays full width. The column is the container, so page grids react to its real width. */}
					<div className="@container/main mx-auto flex w-full max-w-(--content-max) flex-1 flex-col gap-6">
						{children}
					</div>
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
