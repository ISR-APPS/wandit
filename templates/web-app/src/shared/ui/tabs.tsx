// shadcn-style tabs on the Radix tabs primitive (port of shadcn/ui, MIT).
// Status filters of a list page and the tabs of a home page use them.
// The root route sets the Radix direction, so the arrow keys follow Arabic too.
// The activeItem axis sets the --tabs-* role tokens of src/styles/engine.css: a segmented control, an underline, or a chip.

import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "~/shared/lib/utils";

/** The tabs state. Pass value and onValueChange to keep the tab in the URL. */
function Tabs({
	className,
	orientation = "horizontal",
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			data-orientation={orientation}
			orientation={orientation}
			className={cn(
				"group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
				className,
			)}
			{...props}
		/>
	);
}

/** The strip of triggers. The --tabs-list-* tokens give its fill, corners, and padding. Its height is the button height (h-9). */
function TabsList({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			className={cn(
				"group/tabs-list inline-flex w-fit items-center justify-center rounded-(--tabs-list-radius) bg-(--tabs-list-bg) p-(--tabs-list-padding) text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * One tab button. Radix moves the focus with the arrow keys in the document direction.
 * The --tabs-active-* tokens and --nav-active-weight draw the active tab. A --tabs-indicator-height above 0 adds a line under it.
 */
function TabsTrigger({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn(
				// The trigger sits --tabs-list-padding inside the strip, so its corner is the strip corner minus that gap.
				// Every trigger has the active border width in transparent, so the active tab does not move its neighbors.
				"border-(length:--tabs-active-border-width) relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[max(0px,calc(var(--tabs-list-radius)-var(--tabs-list-padding)))] border-transparent px-2 py-1 font-medium text-foreground/60 text-sm transition-all focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				// The hover color is for an inactive tab only: on activeItem=block, foreground text on the primary chip is unreadable.
				// The active border shows only on activeItem=outline, in the nav edge color. Every other value sets its width to 0.
				// The active weight follows the activeItem axis, so activeItem=quiet marks the tab with bold and not with color only.
				"data-[state=active]:border-(--nav-active-border-color) data-[state=active]:bg-(--tabs-active-bg) data-[state=active]:font-(--nav-active-weight) data-[state=active]:text-(--tabs-active-fg) data-[state=active]:shadow-(--tabs-active-shadow) data-[state=inactive]:hover:text-foreground",
				// The line is --ring, the focus color of the theme, so it shows on the page like a focus ring.
				"after:absolute after:bg-ring after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100 group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:end-0 group-data-[orientation=horizontal]/tabs:after:bottom-0 group-data-[orientation=horizontal]/tabs:after:h-(--tabs-indicator-height) group-data-[orientation=vertical]/tabs:after:w-(--tabs-indicator-height)",
				className,
			)}
			{...props}
		/>
	);
}

/** The panel of one tab. Radix renders only the active panel. */
function TabsContent({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			data-slot="tabs-content"
			className={cn("flex-1 outline-none", className)}
			{...props}
		/>
	);
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
