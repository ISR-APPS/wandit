// shadcn-style table parts (port of shadcn/ui, MIT).
// DataTable and every list page build on them. Cells align with logical classes for Arabic.
// The container scrolls sideways, so a wide table never widens the page at 375 px.

import type * as React from "react";
import { cn } from "~/shared/lib/utils";

/** The table inside a container that scrolls sideways. */
function Table({ className, ...props }: React.ComponentProps<"table">) {
	return (
		<div
			data-slot="table-container"
			className="relative w-full overflow-x-auto"
		>
			<table
				data-slot="table"
				className={cn("w-full caption-bottom text-sm", className)}
				{...props}
			/>
		</div>
	);
}

/** The thead. Its rows get a bottom border. */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return (
		<thead
			data-slot="table-header"
			className={cn("[&_tr]:border-b", className)}
			{...props}
		/>
	);
}

/** The tbody. The last row has no bottom border. */
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return (
		<tbody
			data-slot="table-body"
			className={cn("[&_tr:last-child]:border-0", className)}
			{...props}
		/>
	);
}

/** The tfoot, for example a total row, on a muted background. */
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
	return (
		<tfoot
			data-slot="table-footer"
			className={cn(
				"border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
				className,
			)}
			{...props}
		/>
	);
}

/** One tr with a hover background. data-state="selected" marks a selected row. */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
	return (
		<tr
			data-slot="table-row"
			className={cn(
				"border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
				className,
			)}
			{...props}
		/>
	);
}

/** One th. Text starts at the start side; add text-end for a number column. */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				"h-10 whitespace-nowrap px-2 text-start align-middle font-medium text-foreground [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]",
				className,
			)}
			{...props}
		/>
	);
}

/** One td. Text does not wrap; the container scrolls instead. */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				"whitespace-nowrap p-2 align-middle [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]",
				className,
			)}
			{...props}
		/>
	);
}

/** A muted caption under the table, also read by screen readers. */
function TableCaption({
	className,
	...props
}: React.ComponentProps<"caption">) {
	return (
		<caption
			data-slot="table-caption"
			className={cn("mt-4 text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
};
