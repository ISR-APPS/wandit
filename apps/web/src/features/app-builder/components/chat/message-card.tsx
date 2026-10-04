/**
 * Shared surface of the builder cards: the approval card in an assistant
 * message and the diff card of a version. Rendered by approval-card.tsx and
 * diff-card.tsx. One place holds the chrome, so every card lifts the same way.
 */

import { cn } from "@wandit/ui/lib/utils";
import type { ComponentProps } from "react";

/** A card of the thread. Light: a soft lift on parchment. Dark: a lighter surface with a hairline. */
export function MessageCard({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"rounded-2xl border bg-card shadow-card dark:shadow-none",
				className,
			)}
			{...props}
		/>
	);
}
