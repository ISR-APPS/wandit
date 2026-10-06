// App sidebar parts (port of shadcn/ui sidebar, MIT, trimmed for this template).
// The app shell feature composes them: provider, sidebar, trigger, inset, and the menu parts.
// Sides are logical (start, end), so the sidebar sits on the right in Arabic.
// On a phone the sidebar opens as a Sheet. No cookie and no effect: the /app layout keeps the state.
// The group label and the active menu row read the style knobs of src/styles/tokens.css.

import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeftIcon } from "lucide-react";
import { Direction, Slot } from "radix-ui";
import {
	type ComponentProps,
	createContext,
	useContext,
	useState,
	useSyncExternalStore,
} from "react";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Separator } from "~/shared/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/shared/ui/tooltip";

// The Tailwind md breakpoint (48rem) minus 1 px: below it the sidebar is a Sheet.
const MOBILE_QUERY = "(max-width: 767px)";

function subscribeToMobileQuery(onChange: () => void): () => void {
	const query = window.matchMedia(MOBILE_QUERY);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

// A media query is a browser store, so React reads it without an effect.
// The server snapshot is false: SSR renders the desktop layout.
function useIsMobile(): boolean {
	return useSyncExternalStore(
		subscribeToMobileQuery,
		() => window.matchMedia(MOBILE_QUERY).matches,
		() => false,
	);
}

type SidebarContextValue = {
	/** "collapsed" when the desktop sidebar is closed. CSS reads it as data-state. */
	state: "expanded" | "collapsed";
	/** Desktop sidebar open. */
	open: boolean;
	setOpen: (open: boolean) => void;
	/** Mobile Sheet open. A nav link closes it in its click handler. */
	openMobile: boolean;
	setOpenMobile: (open: boolean) => void;
	/** True below the md breakpoint, where the sidebar is a Sheet. */
	isMobile: boolean;
	/** Opens or closes the Sheet on a phone, else the desktop sidebar. */
	toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

/** The sidebar state. Throws outside SidebarProvider. */
function useSidebar(): SidebarContextValue {
	const context = useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider.");
	}
	return context;
}

/** Holds the open state and the widths. `defaultOpen={false}` starts collapsed (the rail shell). */
function SidebarProvider({
	defaultOpen = true,
	className,
	children,
	...props
}: ComponentProps<"div"> & {
	/** Desktop state at mount. The state lives until the /app layout unmounts. */
	defaultOpen?: boolean;
}) {
	const isMobile = useIsMobile();
	const [open, setOpen] = useState(defaultOpen);
	const [openMobile, setOpenMobile] = useState(false);

	const value: SidebarContextValue = {
		state: open ? "expanded" : "collapsed",
		open,
		setOpen,
		openMobile,
		setOpenMobile,
		isMobile,
		toggleSidebar: () =>
			isMobile
				? setOpenMobile((current) => !current)
				: setOpen((current) => !current),
	};

	return (
		<SidebarContext.Provider value={value}>
			<TooltipProvider delayDuration={0}>
				<div
					data-slot="sidebar-wrapper"
					// The icon width holds one 2rem menu button and its padding.
					// A caller overrides a width with a class or a style.
					className={cn(
						"group/sidebar-wrapper flex min-h-svh w-full [--sidebar-width-icon:3rem] [--sidebar-width:16rem] has-data-[variant=inset]:bg-sidebar",
						className,
					)}
					{...props}
				>
					{children}
				</div>
			</TooltipProvider>
		</SidebarContext.Provider>
	);
}

/**
 * The sidebar column. variant: "sidebar" (a bordered column), "floating" (a card), "inset" (the page is the card).
 * collapsible: "offcanvas" slides it out, "icon" keeps the icons, "none" never closes.
 */
function Sidebar({
	label,
	side = "start",
	variant = "sidebar",
	collapsible = "offcanvas",
	className,
	children,
	...props
}: ComponentProps<"div"> & {
	/** Accessible name of the mobile Sheet, already translated. */
	label: string;
	/** Logical side: "start" is the left in a left-to-right language. */
	side?: "start" | "end";
	variant?: "sidebar" | "floating" | "inset";
	collapsible?: "offcanvas" | "icon" | "none";
}) {
	const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

	if (collapsible === "none") {
		return (
			<div
				data-slot="sidebar"
				className={cn(
					"flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
					className,
				)}
				{...props}
			>
				{children}
			</div>
		);
	}

	if (isMobile) {
		return (
			<Sheet open={openMobile} onOpenChange={setOpenMobile}>
				<SheetContent
					data-sidebar="sidebar"
					data-slot="sidebar"
					data-mobile="true"
					// The Sheet has a title and no description.
					aria-describedby={undefined}
					className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [--sidebar-width:18rem] [&>button]:hidden"
					side={side}
				>
					<SheetHeader className="sr-only">
						<SheetTitle>{label}</SheetTitle>
					</SheetHeader>
					<div className="flex h-full w-full flex-col">{children}</div>
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<div
			className="group peer hidden text-sidebar-foreground md:block"
			data-state={state}
			data-collapsible={state === "collapsed" ? collapsible : ""}
			data-variant={variant}
			data-side={side}
			data-slot="sidebar"
		>
			{/* The gap keeps the page beside the fixed sidebar. Its width follows the state. */}
			<div
				data-slot="sidebar-gap"
				className={cn(
					"relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
					"group-data-[collapsible=offcanvas]:w-0",
					variant === "floating" || variant === "inset"
						? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
						: "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
				)}
			/>
			<div
				data-slot="sidebar-container"
				className={cn(
					"fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[inset-inline-start,inset-inline-end,width] duration-200 ease-linear md:flex",
					side === "start"
						? "start-0 group-data-[collapsible=offcanvas]:start-[calc(var(--sidebar-width)*-1)]"
						: "end-0 group-data-[collapsible=offcanvas]:end-[calc(var(--sidebar-width)*-1)]",
					// floating and inset leave a margin around the sidebar; the plain variant draws a border.
					variant === "floating" || variant === "inset"
						? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
						: "border-sidebar-border group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=end]:border-s group-data-[side=start]:border-e",
					className,
				)}
				{...props}
			>
				<div
					data-sidebar="sidebar"
					data-slot="sidebar-inner"
					className="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm"
				>
					{children}
				</div>
			</div>
		</div>
	);
}

/** The button that opens and closes the sidebar. The caller gives the translated aria-label. */
function SidebarTrigger({
	className,
	onClick,
	...props
}: ComponentProps<typeof Button> & {
	/** Translated name of the button, for example t("shell.toggleSidebar"). */
	"aria-label": string;
}) {
	const { toggleSidebar } = useSidebar();
	return (
		<Button
			data-sidebar="trigger"
			data-slot="sidebar-trigger"
			variant="ghost"
			size="icon"
			className={cn("size-7", className)}
			onClick={(event) => {
				onClick?.(event);
				toggleSidebar();
			}}
			{...props}
		>
			<PanelLeftIcon className="rtl:rotate-180" />
		</Button>
	);
}

/** The page column beside the sidebar. A div: the app shell puts its own <main> inside. */
function SidebarInset({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-inset"
			className={cn(
				// min-w-0 lets a wide table scroll inside its card instead of widening the page.
				"relative flex w-full min-w-0 flex-1 flex-col bg-background",
				"md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ms-2 md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ms-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm",
				className,
			)}
			{...props}
		/>
	);
}

/** Top row of the sidebar, for the app name. It keeps its padding when the sidebar collapses. */
function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-header"
			data-sidebar="header"
			className={cn("flex flex-col gap-2 p-2", className)}
			{...props}
		/>
	);
}

/** Bottom row of the sidebar, for the user menu. */
function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-footer"
			data-sidebar="footer"
			className={cn("flex flex-col gap-2 p-2", className)}
			{...props}
		/>
	);
}

/** A line between two sidebar groups, in the sidebar border color. */
function SidebarSeparator({
	className,
	...props
}: ComponentProps<typeof Separator>) {
	return (
		<Separator
			data-slot="sidebar-separator"
			data-sidebar="separator"
			className={cn("mx-2 w-auto bg-sidebar-border", className)}
			{...props}
		/>
	);
}

/** The scroll area between the header and the footer. It hides overflow in the icon state. */
function SidebarContent({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-content"
			data-sidebar="content"
			className={cn(
				"flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
				className,
			)}
			{...props}
		/>
	);
}

/** One block of menu rows, with an optional label. */
function SidebarGroup({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group"
			data-sidebar="group"
			className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
			{...props}
		/>
	);
}

/** Small title of a group. It fades out in the icon state. label-text gives the label knobs. */
function SidebarGroupLabel({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group-label"
			data-sidebar="group-label"
			className={cn(
				"label-text flex h-8 shrink-0 items-center rounded-md px-2 text-sidebar-foreground/70 text-xs outline-hidden ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
				"group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
				className,
			)}
			{...props}
		/>
	);
}

/** The body of a group, under its label. */
function SidebarGroupContent({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group-content"
			data-sidebar="group-content"
			className={cn("w-full text-sm", className)}
			{...props}
		/>
	);
}

/** The list of menu rows (a ul). */
function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu"
			data-sidebar="menu"
			className={cn("flex w-full min-w-0 flex-col gap-1", className)}
			{...props}
		/>
	);
}

/** One row of the menu (a li). It positions a SidebarMenuBadge at its end. */
function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
	return (
		<li
			data-slot="sidebar-menu-item"
			data-sidebar="menu-item"
			className={cn("group/menu-item relative", className)}
			{...props}
		/>
	);
}

/**
 * Sizes of a menu row: "default" for a nav item, "lg" for the user row with an avatar.
 * The active row takes the --nav-active-bg knob. Its ::before bar on the start side is
 * --nav-indicator-width wide, so the default 0px hides it.
 */
const sidebarMenuButtonVariants = cva(
	"peer/menu-button relative flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-start text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] before:absolute before:inset-y-0 before:start-0 before:bg-sidebar-primary hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-badge]/menu-item:pe-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-(--nav-active-bg) data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground data-[active=true]:before:w-(--nav-indicator-width) group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
	{
		variants: {
			size: {
				default: "h-8 text-sm",
				lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
);

/** One menu row. With `tooltip`, the label shows beside the icon while the sidebar is collapsed. */
function SidebarMenuButton({
	asChild = false,
	isActive = false,
	size = "default",
	tooltip,
	className,
	...props
}: ComponentProps<"button"> & {
	/** Renders the child (a router Link) with the row styles. */
	asChild?: boolean;
	/** Marks the row of the current page. */
	isActive?: boolean;
	/** Translated label for the icon-only state. */
	tooltip?: string;
} & VariantProps<typeof sidebarMenuButtonVariants>) {
	// radix-ui exports Slot as a namespace; Root is the component.
	const Comp = asChild ? Slot.Root : "button";
	const { isMobile, state } = useSidebar();
	const dir = Direction.useDirection();

	const button = (
		<Comp
			data-slot="sidebar-menu-button"
			data-sidebar="menu-button"
			data-size={size}
			data-active={isActive}
			className={cn(sidebarMenuButtonVariants({ size }), className)}
			{...props}
		/>
	);

	if (!tooltip) {
		return button;
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent
				// Radix sides are physical: the tooltip opens away from a start sidebar.
				side={dir === "rtl" ? "left" : "right"}
				align="center"
				hidden={state !== "collapsed" || isMobile}
			>
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}

/** A count at the end of a menu row. Show it only for a real count. */
function SidebarMenuBadge({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-menu-badge"
			data-sidebar="menu-badge"
			className={cn(
				"pointer-events-none absolute end-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 font-medium text-sidebar-foreground text-xs tabular-nums",
				"peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
				"peer-data-[size=default]/menu-button:top-1.5",
				"peer-data-[size=lg]/menu-button:top-2.5",
				"group-data-[collapsible=icon]:hidden",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarSeparator,
	SidebarTrigger,
	useSidebar,
};
