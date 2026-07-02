import { cn } from "@my-better-t-app/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

const badgeVariants = cva(
	"inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 font-medium text-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
				secondary:
					"bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
				destructive:
					"bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
				outline:
					"border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
				ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
				link: "text-primary underline-offset-4 [a&]:hover:underline",
				// custom variants
				warning:
					"border border-orange-400 bg-orange-50 text-orange-800 focus-visible:ring-orange-500/20 dark:bg-orange-900/70 dark:text-white/80 dark:focus-visible:ring-orange-500/40 [a&]:hover:bg-orange-500/90",
				info: "border border-blue-400 bg-blue-50 text-blue-800 focus-visible:ring-blue-500/20 dark:bg-blue-900/70 dark:text-white/80 dark:focus-visible:ring-blue-500/40 [a&]:hover:bg-blue-500/90",
				success:
					"border border-green-400 bg-green-50 text-green-800 focus-visible:ring-green-500/20 dark:bg-green-900/70 dark:text-white/80 dark:focus-visible:ring-green-500/40 [a&]:hover:bg-green-500/90",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant = "default",
	asChild = false,
	...props
}: React.ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "span";

	return (
		<Comp
			data-slot="badge"
			data-variant={variant}
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
