// shadcn-style checkbox on the Radix checkbox primitive (port of shadcn/ui, MIT).
// RecordTable selects rows with it. A form can use it with a Label through its id.
// The --field-* role tokens give its shadow; rounded-xs follows the radius axis of theme.json.

import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "~/shared/lib/utils";
import { CheckIcon } from "~/shared/ui/icons";

/**
 * One box. `checked="indeterminate"` draws a dash: a header box uses it when only some rows are selected.
 * Give it an aria-label when no visible label names it.
 */
function Checkbox({
	className,
	...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cn(
				"peer size-4 shrink-0 rounded-xs border border-input bg-(--field-bg) shadow-field outline-none transition-shadow focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=indeterminate]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:text-primary-foreground",
				className,
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot="checkbox-indicator"
				className="group flex items-center justify-center text-current"
			>
				{/* The indicator shows in both states. The state picks the mark: a check, or a dash for "some". */}
				<CheckIcon className="size-3.5 group-data-[state=indeterminate]:hidden" />
				<span className="hidden h-0.5 w-2 rounded-full bg-current group-data-[state=indeterminate]:block" />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
