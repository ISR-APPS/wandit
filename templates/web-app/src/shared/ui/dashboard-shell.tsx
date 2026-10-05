// Shared workspace chrome for generated dashboard routes.
// Workspace features supply translated content, authorized links, and static layout choices.
// Radix Sheet manages focus, Escape, and dismissal on small screens.
import { Slot } from "radix-ui";
import {
	type ReactElement,
	type ReactNode,
	useEffect,
	useId,
	useState,
} from "react";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { MenuIcon } from "~/shared/ui/icons";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/shared/ui/sheet";

type DashboardShellProps = {
	/** Generation selects this layout; the app does not expose a theme control. */
	variant?: "sidebar" | "inset" | "rail";
	/** Compact spacing supports tables; comfortable spacing supports summaries. */
	density?: "compact" | "comfortable";
	/** Centered content stops growing on wide screens. */
	contentWidth?: "full" | "centered";
	/** Product identity, normally a translated TanStack Link. */
	brand: ReactNode;
	/** Call closeNavigation from each link's onClick to dismiss the mobile sheet. */
	navigation: (closeNavigation: () => void) => ReactNode;
	/** Account or workspace actions appear below navigation. */
	sidebarFooter?: ReactNode;
	/** Route context, search, and account actions appear in the top bar. */
	header?: ReactNode;
	children: ReactNode;
	/** Translated accessible name for both navigation landmarks. */
	navigationLabel: string;
	/** Translated mobile menu button name. */
	openNavigationLabel: string;
	/** Translated sheet close button name. */
	closeNavigationLabel: string;
	/** Translated keyboard shortcut link to the main content. */
	skipToContentLabel: string;
};

/** Features own links and data loading. Protected routes keep their authorization guards. */
export function DashboardShell({
	variant = "sidebar",
	density = "comfortable",
	contentWidth = "full",
	brand,
	navigation,
	sidebarFooter,
	header,
	children,
	navigationLabel,
	openNavigationLabel,
	closeNavigationLabel,
	skipToContentLabel,
}: DashboardShellProps) {
	const [navigationOpen, setNavigationOpen] = useState(false);
	const contentId = useId();
	const closeNavigation = () => setNavigationOpen(false);

	// effect: Release the Sheet focus trap when the browser reaches the desktop breakpoint.
	useEffect(() => {
		// The query matches Tailwind lg; a desktop resize must release the mobile focus trap.
		const desktop = window.matchMedia("(min-width: 64rem)");
		const closeOnDesktop = (event: MediaQueryListEvent) => {
			if (event.matches) setNavigationOpen(false);
		};
		desktop.addEventListener("change", closeOnDesktop);
		return () => desktop.removeEventListener("change", closeOnDesktop);
	}, []);

	return (
		<div
			data-dashboard-shell=""
			data-variant={variant}
			data-density={density}
			className={cn(
				"group/dashboard grid min-h-dvh grid-cols-1 bg-background text-foreground",
				// A rail keeps text labels visible while giving more room to the workspace.
				variant === "rail"
					? "lg:grid-cols-[7rem_minmax(0,1fr)]"
					: "lg:grid-cols-[16rem_minmax(0,1fr)]",
				// Inset workspaces sit inside the navigation surface.
				variant === "inset" && "bg-sidebar",
			)}
		>
			<a
				href={`#${contentId}`}
				className="sr-only fixed start-4 top-4 z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only"
			>
				{skipToContentLabel}
			</a>
			<aside
				className={cn(
					"sticky top-0 hidden h-dvh min-w-0 flex-col bg-sidebar text-sidebar-foreground lg:flex",
					// The inset border belongs to the content panel, not the navigation.
					variant !== "inset" && "border-sidebar-border border-e",
				)}
			>
				<div className="wrap-anywhere flex min-h-16 items-center p-4 font-semibold group-data-[variant=rail]/dashboard:justify-center group-data-[variant=rail]/dashboard:p-2 group-data-[variant=rail]/dashboard:text-center group-data-[variant=rail]/dashboard:text-sm">
					{brand}
				</div>
				<nav
					aria-label={navigationLabel}
					className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3 group-data-[variant=rail]/dashboard:p-2"
				>
					{navigation(closeNavigation)}
				</nav>
				<div className="wrap-anywhere mt-auto p-4 group-data-[variant=rail]/dashboard:p-2">
					{sidebarFooter}
				</div>
			</aside>
			<div
				className={cn(
					"flex min-w-0 flex-col bg-background",
					// The inset surface creates a separate workspace without changing route content.
					variant === "inset" &&
						"lg:my-3 lg:me-3 lg:rounded-2xl lg:border lg:shadow-sm",
				)}
			>
				<header className="flex min-h-16 min-w-0 flex-wrap items-center gap-3 border-b px-4 py-3 group-data-[density=comfortable]/dashboard:lg:px-8">
					<Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
						<SheetTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="icon"
								aria-label={openNavigationLabel}
								className="lg:hidden"
							>
								<MenuIcon />
							</Button>
						</SheetTrigger>
						<SheetContent
							side="start"
							closeLabel={closeNavigationLabel}
							aria-describedby={undefined}
							data-density={density}
							className="group/dashboard w-72 max-w-full gap-0 bg-sidebar text-sidebar-foreground"
						>
							<SheetHeader className="pe-12">
								<SheetTitle className="text-sidebar-foreground">
									{navigationLabel}
								</SheetTitle>
							</SheetHeader>
							<nav
								aria-label={navigationLabel}
								className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3"
							>
								{navigation(closeNavigation)}
							</nav>
							<div className="mt-auto p-4">{sidebarFooter}</div>
						</SheetContent>
					</Sheet>
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
						{header}
					</div>
				</header>
				<main
					id={contentId}
					tabIndex={-1}
					data-content-width={contentWidth}
					className={cn(
						"mx-auto flex w-full min-w-0 flex-1 flex-col gap-4 p-4 outline-none group-data-[density=comfortable]/dashboard:gap-8 group-data-[density=comfortable]/dashboard:lg:p-8",
						// Long rows keep full width; reading pages can use a fixed maximum width.
						contentWidth === "centered" && "max-w-7xl",
					)}
				>
					{children}
				</main>
			</div>
		</div>
	);
}

/** Pass one TanStack Link with an icon and visible translated text as its children. */
export function DashboardNavItem({
	children,
	active = false,
}: {
	/** The caller supplies the route and closes mobile navigation on selection. */
	children: ReactElement;
	/** The route decides this value; it is not an authorization check. */
	active?: boolean;
}) {
	return (
		<Slot.Root
			aria-current={active ? "page" : undefined}
			data-active={active}
			className="[&>span]:wrap-anywhere flex min-h-11 min-w-0 items-center gap-3 rounded-md px-3 py-2 text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground group-data-[density=compact]/dashboard:min-h-9 group-data-[variant=rail]/dashboard:min-h-16 group-data-[variant=rail]/dashboard:flex-col group-data-[variant=rail]/dashboard:justify-center group-data-[variant=rail]/dashboard:gap-1 group-data-[variant=rail]/dashboard:px-2 group-data-[variant=rail]/dashboard:text-center group-data-[variant=rail]/dashboard:text-xs [&>span]:min-w-0 [&>svg]:size-4 [&>svg]:shrink-0"
		>
			{children}
		</Slot.Root>
	);
}
