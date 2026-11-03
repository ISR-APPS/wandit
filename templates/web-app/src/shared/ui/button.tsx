// shadcn-style button with cva variants.
// Every interactive action uses this component.
// The --control-* role tokens of src/styles/engine.css give its corners, border, and shadow.
// The radius, border, and shadow axes of theme.json set those tokens, so the button needs no theme prop.
// The heights use the spacing scale, so the scale axis resizes them.

import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "~/shared/lib/utils";

// The shadow axes give the shadow. On shadowStyle=hard, --control-press is the shadow offset, so :active moves the button onto its shadow.
// translate-x is physical, like the shadow offset, so the press is correct in Arabic too.
const pressable =
	"shadow-(--control-shadow) active:translate-x-(--control-press) active:translate-y-(--control-press) active:shadow-(--control-shadow-pressed)";

// A filled button keeps a border of the control width, so it has the size of the outline button.
// --control-border-color is transparent, except ink on shadowStyle=hard.
const filledEdge =
	"border-(length:--control-border-width) border-(--control-border-color)";

/** Button looks and sizes. `default` is the one main action of a screen. ghost and link have no border and no shadow. */
const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-(--control-radius) font-medium text-sm outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: [
					pressable,
					filledEdge,
					"bg-primary text-primary-foreground hover:bg-primary/90",
				],
				destructive: [
					pressable,
					filledEdge,
					"bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20",
				],
				// At least 1px: a 0.5px border is too faint, and the border is the only mark of this variant.
				outline: [
					pressable,
					"border-(--field-border-color) border-[length:max(1px,var(--control-border-width))] bg-transparent hover:bg-accent hover:text-accent-foreground",
				],
				secondary: [
					pressable,
					filledEdge,
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				],
				ghost: "hover:bg-accent hover:text-accent-foreground",
				// A light accent can be under 4.5:1 as text, so the text is ink. The underline is the --ring focus color.
				link: "text-foreground underline decoration-ring underline-offset-4 hover:decoration-2",
			},
			// The shadcn heights. data-scale changes --spacing, so every size follows the scale axis.
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-8 gap-1.5 px-3 text-xs",
				lg: "h-10 px-6",
				icon: "size-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	/** Renders the child element instead of a button, keeping the styles. */
	asChild?: boolean;
}

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: ButtonProps) {
	// radix-ui exports Slot as a namespace; Root is the component.
	const Comp = asChild ? Slot.Root : "button";
	return (
		<Comp
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export type { ButtonProps };
export { Button, buttonVariants };
