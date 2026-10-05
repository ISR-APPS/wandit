// shadcn-style dropdown menu on the Radix menu primitive (port of shadcn/ui, MIT).
// The user menu of the sidebar and the row actions of a table use these parts.
// Logical padding (ps, pe) keeps the items correct in Arabic.

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "~/shared/lib/utils";

/** The menu state. Put one trigger and one content inside. */
function DropdownMenu({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
	return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

/** Renders its children under body, outside the overflow of the page. */
function DropdownMenuPortal({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
	return (
		<DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
	);
}

/** The control that opens the menu. Use asChild with a Button. */
function DropdownMenuTrigger({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
	return (
		<DropdownMenuPrimitive.Trigger
			data-slot="dropdown-menu-trigger"
			{...props}
		/>
	);
}

/** The menu panel. It renders in a portal under body, so it reads the page tokens. */
function DropdownMenuContent({
	className,
	sideOffset = 4,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
	return (
		<DropdownMenuPrimitive.Portal>
			<DropdownMenuPrimitive.Content
				data-slot="dropdown-menu-content"
				sideOffset={sideOffset}
				className={cn(
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in",
					className,
				)}
				{...props}
			/>
		</DropdownMenuPrimitive.Portal>
	);
}

/** Groups related items for screen readers. */
function DropdownMenuGroup({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
	return (
		<DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
	);
}

/** One action. `variant="destructive"` colors a delete or another action that loses data. */
function DropdownMenuItem({
	className,
	variant = "default",
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
	/** "destructive" for an action that deletes data. */
	variant?: "default" | "destructive";
}) {
	return (
		<DropdownMenuPrimitive.Item
			data-slot="dropdown-menu-item"
			data-variant={variant}
			className={cn(
				"relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[variant=destructive]:text-destructive data-[disabled]:opacity-50 data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 data-[variant=destructive]:*:[svg]:text-destructive!",
				className,
			)}
			{...props}
		/>
	);
}

/** A non-interactive line, for example the email of the user. */
function DropdownMenuLabel({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
	return (
		<DropdownMenuPrimitive.Label
			data-slot="dropdown-menu-label"
			className={cn("px-2 py-1.5 font-medium text-sm", className)}
			{...props}
		/>
	);
}

/** A line between two groups of items. */
function DropdownMenuSeparator({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
	return (
		<DropdownMenuPrimitive.Separator
			data-slot="dropdown-menu-separator"
			className={cn("-mx-1 my-1 h-px bg-border", className)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
};
