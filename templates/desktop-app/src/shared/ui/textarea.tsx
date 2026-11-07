// shadcn-style textarea.
// Multi-line form fields use it. It grows with its content.
// The --field-* role tokens of src/styles/engine.css give its corners, border, fill, and shadow.

import type * as React from "react";
import { cn } from "~/shared/lib/utils";

/** A multi-line field. It starts at 16 spacing steps high (min-h-16) and grows with its text. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"field-sizing-content border-(length:--field-border-width) flex min-h-16 w-full rounded-(--field-radius) border-(--field-border-color) bg-(--field-bg) px-3 py-2 text-base shadow-(--field-shadow) outline-none transition-[color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
				// An invalid field gets at least 1px, so the error shows without focus on a 0.5px border.
				"aria-invalid:border-[length:max(1px,var(--field-border-width))] aria-invalid:border-destructive aria-invalid:ring-destructive/20",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
