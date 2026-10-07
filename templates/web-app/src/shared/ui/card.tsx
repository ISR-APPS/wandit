// shadcn-style card primitives (port of shadcn/ui, MIT).
// Sections, KPI cards, and chart cards use these slots.
// CardAction puts a control (a period Select, an icon) at the end of the header row.
// Card and CardTitle read the style knobs of src/styles/tokens.css.

import type * as React from "react";
import { cn } from "~/shared/lib/utils";

/**
 * A panel. The --surface-* knobs give its border width, corners, and shadow.
 * cn() drops a knob class when the caller gives a full radius, a border width, or a shadow size.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card"
			className={cn(
				"border-(length:--surface-border-width) flex flex-col gap-6 rounded-(--surface-radius) bg-card py-6 text-card-foreground shadow-(--surface-shadow)",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * The title and the description rows. A CardAction child adds an end column.
 * Children can use `@container/card-header` queries on its width.
 */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				"@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
				className,
			)}
			{...props}
		/>
	);
}

/** The panel title. The --title-* knobs give its weight, tracking, and case. A caller class wins. */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-title"
			className={cn(
				"font-(--title-weight) leading-none tracking-(--title-tracking) [text-transform:var(--title-case)]",
				className,
			)}
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

/** A control at the end of the header, beside the title and the description. */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-action"
			className={cn(
				"col-start-2 row-span-2 row-start-1 self-start justify-self-end",
				className,
			)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-content"
			className={cn("px-6", className)}
			{...props}
		/>
	);
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-footer"
			className={cn("flex items-center px-6", className)}
			{...props}
		/>
	);
}

export {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
};
