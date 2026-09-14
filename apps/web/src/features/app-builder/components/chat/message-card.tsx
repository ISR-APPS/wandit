/**
 * Shared surface of the cards inside an assistant message: the change card,
 * the progress card, the trace, the tool chips, the question, the suggestion,
 * and the diff. Rendered by those components under components/chat.
 * One place holds the chrome, so every card lifts from the thread the same way.
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
