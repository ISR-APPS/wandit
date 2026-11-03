// App sidebar parts (port of shadcn/ui sidebar, MIT, trimmed for this template).
// The app shell feature composes them: provider, sidebar, trigger, inset, and the menu parts.
// Sides are logical (start, end), so the sidebar sits on the right in Arabic.
// On a phone the sidebar opens as a Sheet. No cookie and no effect: the /app layout keeps the state.
// The shell and nav tokens of src/styles/engine.css give the sizes, corners, rules, shadows, and menu rows.
// The "rail" collapse is a port of the isr-viraly rail: each nav label stays under its icon.

import { cva, type VariantProps } from "class-variance-authority";
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
import { SidebarSimpleIcon } from "~/shared/ui/icons";
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

/** Holds the open state of the desktop sidebar and of the phone Sheet. `defaultOpen={false}` starts collapsed. */
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
					// engine.css gives --sidebar-width, --sidebar-width-icon, and --sidebar-width-rail.
					// The backdrop: inset puts the page panel on the sidebar tone, floating puts the panels on the canvas.
					className={cn(
						"group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=floating]:bg-canvas has-data-[variant=inset]:bg-sidebar",
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

// The collapsed column of each variant in the icon and the rail modes. Tailwind sees only literal classes, so each is written out.
const COLLAPSED_WIDTH_CLASSES = {
	sidebar:
		"group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+var(--sidebar-border-width))] group-data-[collapsible=rail]:w-[calc(var(--sidebar-width-rail)+var(--sidebar-border-width))]",
	inset:
		"group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+var(--shell-gap)*2)] group-data-[collapsible=rail]:w-[calc(var(--sidebar-width-rail)+var(--shell-gap)*2)]",
	floating:
		"group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+var(--shell-gap)*2+var(--shell-panel-border-width)*2)] group-data-[collapsible=rail]:w-[calc(var(--sidebar-width-rail)+var(--shell-gap)*2+var(--shell-panel-border-width)*2)]",
} as const;

/**
 * The sidebar column. variant: "sidebar" (a column with an edge rule), "floating" (a detached panel),
 * "inset" (the page is the panel). collapsible: "offcanvas" slides it out, "icon" keeps the icons,
 * "rail" keeps the icons with their label under them. Below 48rem every variant is a Sheet.
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
	collapsible?: "offcanvas" | "icon" | "rail";
}) {
	const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

	// The collapsed width. floating and inset add the --shell-gap margin; floating and sidebar add their rule.
	// The gap and the container use the same class, so the page starts where the sidebar ends.
	const collapsedWidthClass = COLLAPSED_WIDTH_CLASSES[variant];

	if (isMobile) {
		return (
			<Sheet open={openMobile} onOpenChange={setOpenMobile}>
				<SheetContent
					data-sidebar="sidebar"
					data-slot="sidebar"
					data-mobile="true"
					// The Sheet has a title and no description.
					aria-describedby={undefined}
					className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
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
					collapsedWidthClass,
				)}
			/>
			<div
				data-slot="sidebar-container"
				className={cn(
					"fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[inset-inline-start,inset-inline-end,width] duration-200 ease-linear md:flex",
					side === "start"
						? "start-0 group-data-[collapsible=offcanvas]:start-[calc(var(--sidebar-width)*-1)]"
						: "end-0 group-data-[collapsible=offcanvas]:end-[calc(var(--sidebar-width)*-1)]",
					// floating and inset leave a margin around the sidebar; the plain variant draws its edge rule.
					variant === "floating" || variant === "inset"
						? "p-(--shell-gap)"
						: "group-data-[side=end]:border-s-(length:--sidebar-border-width) group-data-[side=start]:border-e-(length:--sidebar-border-width) border-sidebar-border",
					collapsedWidthClass,
					className,
				)}
				{...props}
			>
				<div
					data-sidebar="sidebar"
					data-slot="sidebar-inner"
					className="group-data-[variant=floating]:border-(length:--shell-panel-border-width) flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-(--shell-panel-radius) group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-(--shell-panel-shadow)"
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
			<SidebarSimpleIcon className="rtl:rotate-180" />
		</Button>
	);
}

/**
 * The page column beside the sidebar. A div: the app shell puts its own <main> inside.
 * floating: the page sits on the canvas. inset: the page is a raised panel drawn with the shell tokens.
 * --page-surface is the color of the column. The bar and blur headers of engine.css fill with it.
 */
function SidebarInset({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-inset"
			className={cn(
				// min-w-0 lets a wide table scroll inside its card instead of widening the page.
				"relative flex w-full min-w-0 flex-1 flex-col bg-(--page-surface) [--page-surface:var(--background)]",
				"md:peer-data-[variant=floating]:[--page-surface:var(--canvas)]",
				// The sidebar container already holds the gap on its end side. Only an offcanvas sidebar that is out leaves none.
				"md:peer-data-[variant=inset]:peer-data-[collapsible=offcanvas]:ms-(--shell-gap) md:peer-data-[variant=inset]:m-(--shell-gap) md:peer-data-[variant=inset]:ms-0",
				"md:peer-data-[variant=inset]:border-(length:--shell-panel-border-width) md:peer-data-[variant=inset]:rounded-(--shell-panel-radius) md:peer-data-[variant=inset]:border-(--shell-panel-border-color) md:peer-data-[variant=inset]:shadow-(--shell-panel-shadow)",
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

/** The scroll area between the header and the footer. It hides overflow in the icon state, and the side overflow in the rail. */
function SidebarContent({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-content"
			data-sidebar="content"
			className={cn(
				"flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=rail]:overflow-x-hidden",
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

/** Small title of a group. It fades out in the icon and the rail states. label-text gives the label weight. */
function SidebarGroupLabel({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group-label"
			data-sidebar="group-label"
			className={cn(
				// Full text color: a 70% mix fails 4.5:1 on the brand and contrast tones. label-text marks it as a label.
				"label-text flex h-8 shrink-0 items-center rounded-md px-2 text-sidebar-foreground text-xs outline-hidden ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
				"group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=rail]:-mt-8 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=rail]:opacity-0",
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
 * Sizes of a menu row: "default" for a nav item, "lg" for the brand row and the user row.
 * The row reads the nav tokens of engine.css. The active row text is --nav-active-fg, never the accent
 * foreground: on the brand tone that token can equal the sidebar color.
 * Every row keeps a transparent border of the active width, so the outline nav does not move the label.
 * The ::before bar on the start side is --nav-indicator-width wide, so the default 0px hides it.
 * In the collapsed rail a default row stacks its icon over its label (`<Icon /><span>label</span>`).
 * An lg row (the brand, the user) keeps only its size-8 tile, in the middle of the rail.
 */
const sidebarMenuButtonVariants = cva(
	"peer/menu-button border-(length:--nav-active-border-width) relative flex w-full items-center gap-2 overflow-hidden rounded-nav border-transparent p-2 text-start font-medium text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] before:absolute before:inset-y-0 before:start-0 before:bg-(--nav-indicator-color) hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-badge]/menu-item:pe-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:border-(--nav-active-border-color) data-[active=true]:bg-(--nav-active-bg) data-[active=true]:font-(--nav-active-weight) data-[active=true]:text-(--nav-active-fg) data-[active=true]:shadow-(--nav-active-shadow) data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground data-[active=true]:before:w-(--nav-indicator-width) group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
	{
		variants: {
			size: {
				// --nav-muted-fg: the quiet nav mutes the rows that are not active.
				// rounded-lg in the rail: a pill corner on the tall rail tile looks like a capsule.
				// The rail row grows to fit the icon tile and the label. A fixed height cuts the label.
				default:
					"h-8 text-(--nav-muted-fg) text-sm group-data-[collapsible=rail]:h-auto group-data-[collapsible=rail]:flex-col group-data-[collapsible=rail]:justify-center group-data-[collapsible=rail]:gap-1 group-data-[collapsible=rail]:rounded-lg group-data-[collapsible=rail]:px-1 group-data-[collapsible=rail]:text-xs group-data-[collapsible=rail]:[&>span:last-child]:max-w-full group-data-[collapsible=rail]:[&>svg]:size-5",
				lg: "h-12 text-sm group-data-[collapsible=rail]:mx-auto group-data-[collapsible=rail]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=rail]:p-0!",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
);

/** One menu row. With `tooltip`, the label shows beside the icon while the sidebar is collapsed, also a cut rail label. */
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

/** A count at the end of a menu row. Show it only for a real count. On the active row it takes --nav-active-fg. */
function SidebarMenuBadge({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-menu-badge"
			data-sidebar="menu-badge"
			className={cn(
				// Centered on the row, so it fits every row height of the scale axis.
				"pointer-events-none absolute end-1 top-1/2 flex h-5 min-w-5 -translate-y-1/2 select-none items-center justify-center rounded-md px-1 font-medium text-sidebar-foreground text-xs tabular-nums",
				"peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-(--nav-active-fg)",
				"group-data-[collapsible=icon]:hidden group-data-[collapsible=rail]:hidden",
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
