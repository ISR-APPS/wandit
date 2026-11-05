// shadcn-style text input.
// Forms use it for text, email, tel, and number fields.
// The --field-* role tokens of src/styles/engine.css give its corners, border, fill, and shadow.
// Its height is h-9, the button height, so it follows the scale axis.

import type * as React from "react";
import { cn } from "~/shared/lib/utils";

/** One text field. Pair it with a Label through its id. A caller class wins over each token class. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"border-(length:--field-border-width) h-9 w-full min-w-0 rounded-(--field-radius) border-(--field-border-color) bg-(--field-bg) px-3 py-1 text-base shadow-(--field-shadow) outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
				// An invalid field gets at least 1px, so the error shows without focus on a 0.5px border.
				"aria-invalid:border-[length:max(1px,var(--field-border-width))] aria-invalid:border-destructive aria-invalid:ring-destructive/20",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
