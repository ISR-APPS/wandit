// The frame of every page: the kit Sidebar (AppSidebar), the header, and the page column.
// RootLayout renders it around the current route. It reads the sidebar fields of theme.json from useAppTheme().
// The desktop window is at least 800 px wide, so the sidebar shows beside the page. The other axes style it through engine.css.
// The page column is <main>. Its spacing uses the spacing scale, so the scale axis resizes it.
import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "~/shared/ui/sidebar";
import { type AppThemeFile, useAppTheme } from "~/styles/theme";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

type AppShellProps = {
	/** The page of the current route. */
	children: ReactNode;
};

type ThemeSelection = AppThemeFile["selection"];

/** The kit Sidebar variant of each sidebarStyle. "classic" is the kit "sidebar": a column with an edge rule. */
const SIDEBAR_VARIANTS = {
	inset: "inset",
	classic: "sidebar",
	floating: "floating",
} as const satisfies Record<ThemeSelection["sidebarStyle"], string>;

/** The kit collapsible mode of each sidebarCollapse: what the menu button does in a wide window. */
const SIDEBAR_COLLAPSIBLES = {
	icons: "icon",
	rail: "rail",
	offcanvas: "offcanvas",
} as const satisfies Record<ThemeSelection["sidebarCollapse"], string>;

/** The sidebar, then the page column. The other theme axes sit on <html> as data-* attributes. */
export function AppShell({ children }: AppShellProps) {
	const { sidebarStyle, sidebarCollapse, sidebarStart } =
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
				variant={SIDEBAR_VARIANTS[sidebarStyle]}
				collapsible={SIDEBAR_COLLAPSIBLES[sidebarCollapse]}
			/>
			<SidebarInset>
				<AppHeader />
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
