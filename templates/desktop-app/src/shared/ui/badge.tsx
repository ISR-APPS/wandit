// shadcn-style badge with cva variants.
// Status labels and small tags use it. success, warning, and info read the status tokens.
// --badge-radius and --badge-border-width of src/styles/engine.css give its corners and its border.

import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "~/shared/lib/utils";

/** Badge looks. A list page maps each status to one variant with `satisfies Record<Status, ...>`. */
const badgeVariants = cva(
	// The border axis gives the border width.
	"border-(length:--badge-border-width) inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-(--badge-radius) px-2 py-0.5 font-medium text-xs [&>svg]:pointer-events-none [&>svg]:size-3",
	{
		variants: {
			// A filled badge draws its edge in --control-border-color: transparent, except ink on shadowStyle=hard.
			variant: {
				default:
					"border-(--control-border-color) bg-primary text-primary-foreground hover:bg-primary/90",
				secondary:
					"border-(--control-border-color) bg-secondary text-secondary-foreground hover:bg-secondary/90",
				destructive:
					"border-(--control-border-color) bg-destructive text-destructive-foreground hover:bg-destructive/90",
				// At least 1px: a 0.5px border is too faint, and the border is the only mark of this variant.
				// cn() keeps this width and drops the base width.
				outline:
					"border-(--field-border-color) border-[length:max(1px,var(--badge-border-width))] text-foreground hover:bg-accent hover:text-accent-foreground",
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
