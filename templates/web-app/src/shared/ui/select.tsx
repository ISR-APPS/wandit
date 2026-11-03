// shadcn-style select on the Radix select primitive.
// Dropdown fields (for example a wilaya picker) use these parts.
// The trigger reads the --field-* role tokens of src/styles/engine.css, the list reads the --overlay-* tokens.

import { Select as SelectPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "~/shared/lib/utils";
import { CaretDownIcon, CaretUpIcon, CheckIcon } from "~/shared/ui/icons";

function Select({
	...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
	return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
	...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
	return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
	...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
	return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

/** The closed field that shows the value. It has the height and the look of an Input. */
function SelectTrigger({
	className,
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			className={cn(
				"border-(length:--field-border-width) flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-(--field-radius) border-(--field-border-color) bg-(--field-bg) px-3 py-2 text-sm shadow-(--field-shadow) outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				// An invalid field gets at least 1px, so the error shows without focus on a 0.5px border.
				"aria-invalid:border-[length:max(1px,var(--field-border-width))] aria-invalid:border-destructive aria-invalid:ring-destructive/20",
				className,
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon asChild>
				<CaretDownIcon className="size-4 opacity-50" />
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
}

/** The open list. "popper" places it under the trigger, at least as wide as the trigger. */
function SelectContent({
	className,
	children,
	position = "popper",
	...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Content
				data-slot="select-content"
				className={cn(
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 border-(length:--overlay-border-width) relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-(--overlay-radius) border-(--overlay-border-color) bg-popover text-popover-foreground shadow-(--overlay-shadow) data-[state=closed]:animate-out data-[state=open]:animate-in",
					position === "popper" &&
						"data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
					className,
				)}
				position={position}
				{...props}
			>
				<SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
					<CaretUpIcon className="size-4" />
				</SelectPrimitive.ScrollUpButton>
				<SelectPrimitive.Viewport
					className={cn(
						"p-1",
						position === "popper" &&
							"h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
					)}
				>
					{children}
				</SelectPrimitive.Viewport>
				<SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
					<CaretDownIcon className="size-4" />
				</SelectPrimitive.ScrollDownButton>
			</SelectPrimitive.Content>
		</SelectPrimitive.Portal>
	);
}

/** One option. A check mark at the end side marks the chosen option. */
function SelectItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
	return (
		<SelectPrimitive.Item
			data-slot="select-item"
			className={cn(
				// The item sits 0.25rem inside the list: the p-1 of the viewport. Its corner is the list corner minus that gap.
				"relative flex w-full cursor-default select-none items-center gap-2 rounded-[max(0px,calc(var(--overlay-radius)-0.25rem))] py-1.5 ps-2 pe-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			<span className="absolute end-2 flex size-3.5 items-center justify-center">
				<SelectPrimitive.ItemIndicator>
					<CheckIcon className="size-4" />
				</SelectPrimitive.ItemIndicator>
			</span>
			<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
		</SelectPrimitive.Item>
	);
}

function SelectSeparator({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
	return (
		<SelectPrimitive.Separator
			data-slot="select-separator"
			className={cn("-mx-1 my-1 h-px bg-border", className)}
			{...props}
		/>
	);
}

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
};
