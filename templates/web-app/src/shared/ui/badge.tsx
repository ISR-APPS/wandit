// shadcn-style badge with cva variants.
// Status labels and small tags use it. success, warning, and info read the status tokens.
// The corner radius follows --control-radius from tokens.css, like the buttons.

import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "~/shared/lib/utils";

/** Badge looks. A list page maps each status to one variant with `satisfies Record<Status, ...>`. */
const badgeVariants = cva(
	"inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-control border px-2 py-0.5 font-medium text-xs [&>svg]:pointer-events-none [&>svg]:size-3",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90",
				destructive:
					"border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
				outline: "text-foreground hover:bg-accent hover:text-accent-foreground",
				success: "border-success/25 bg-success/12 text-success",
				warning: "border-warning/25 bg-warning/12 text-warning",
				info: "border-info/25 bg-info/12 text-info",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant,
	asChild = false,
	...props
}: React.ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	// radix-ui exports Slot as a namespace; Root is the component.
	const Comp = asChild ? Slot.Root : "span";
	return (
		<Comp
			data-slot="badge"
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
