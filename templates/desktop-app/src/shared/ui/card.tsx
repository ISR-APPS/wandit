// shadcn-style card primitives (port of shadcn/ui, MIT).
// Sections, KPI cards, and chart cards use these slots.
// CardAction puts a control (a period Select, an icon) at the end of the header row.
// Card reads the --surface-* role tokens of src/styles/engine.css: border, corners, and shadow.
// The paddings use the spacing scale (the shadcn 6 steps), so the scale axis resizes them.

import type * as React from "react";
import { cn } from "~/shared/lib/utils";

/**
 * A panel. The --surface-* tokens give its border, corners, and shadow. py-6 and gap-6 space the slots.
 * cn() drops a token class when the caller gives a radius, a border, a shadow, a padding, or a gap class.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card"
			className={cn(
				// min-w-0: in a grid with no column count, a chart or a wide table must not widen the page at 375 px.
				"border-(length:--surface-border-width) flex min-w-0 flex-col gap-6 rounded-(--surface-radius) border-(--surface-border-color) bg-card py-6 text-card-foreground shadow-(--surface-shadow)",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * The title and the description rows. A CardAction child adds an end column.
 * Its side padding is px-6, like CardContent and CardFooter.
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

/** The panel title, semibold in the body face. A caller class wins. */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-title"
			className={cn("font-semibold leading-none", className)}
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

/** The body of the panel. Its side padding is px-6. */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-content"
			className={cn("px-6", className)}
			{...props}
		/>
	);
}

/** A row of actions or notes under the body. Its side padding is px-6. */
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
