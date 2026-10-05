"use client";

/**
 * Searchable list of the web app, on top of cmdk. It sits in a kit Popover.
 * The look copies the dropdown menu: a white sheet, grotesk rows, a navy tint
 * on the focused row, and the row icon turns ember. The preview route picker
 * and the phone step of onboarding render it.
 */

import { cn } from "@wandit/ui/lib/utils";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";
import type * as React from "react";

// The 20 px sheet corner is the 14 px row corner plus the 6 px list padding (p-1.5 on CommandList).
function Command({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			data-slot="command"
			className={cn(
				"flex h-full w-full flex-col overflow-hidden rounded-[20px] bg-popover text-popover-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function CommandInput({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
	return (
		<div
			data-slot="command-input-wrapper"
			className="flex h-12 items-center gap-2.5 border-popover-foreground/[0.08] border-b px-4"
		>
			<SearchIcon className="size-4 shrink-0 text-popover-foreground/45" />
			<CommandPrimitive.Input
				data-slot="command-input"
				className={cn(
					"flex h-10 w-full bg-transparent py-3 text-sm outline-hidden placeholder:text-popover-foreground/40 disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

function CommandList({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot="command-list"
			className={cn(
				"max-h-[300px] scroll-py-1.5 overflow-y-auto overflow-x-hidden p-1.5",
				className,
			)}
			{...props}
		/>
	);
}

function CommandEmpty({
	...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="command-empty"
			className="py-6 text-center text-popover-foreground/55 text-sm"
			{...props}
		/>
	);
}

function CommandGroup({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot="command-group"
			className={cn(
				"overflow-hidden [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-grotesk [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-popover-foreground/45 [&_[cmdk-group-heading]]:text-xs",
				className,
			)}
			{...props}
		/>
	);
}

function CommandSeparator({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			data-slot="command-separator"
			className={cn(
				"-mx-1.5 my-1.5 h-px bg-popover-foreground/[0.07]",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * One row, with the look of a dropdown menu row. An svg with its own size-* or
 * text-* class keeps it. Other icons are 18 px and dim, and turn ember on the selected row.
 */
function CommandItem({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			data-slot="command-item"
			className={cn(
				"relative flex cursor-default select-none items-center gap-2.5 rounded-[14px] px-2.5 py-2 font-grotesk font-medium text-sm outline-hidden transition-colors data-[disabled=true]:pointer-events-none data-[selected=true]:bg-popover-foreground/[0.05] data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-[18px] [&_svg:not([class*='text-'])]:text-popover-foreground/45 data-[selected=true]:[&_svg:not([class*='text-'])]:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:transition-colors",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
};
