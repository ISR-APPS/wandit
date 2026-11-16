// The name of a tracked event as the tracking code writes it: a small chip in the code face.
// The event catalog, the stream, and the funnel render it.
import { cn } from "~/shared/lib/utils";
import type { EventKey } from "../lib/event-types";

type EventNameProps = {
	/** The event name, for example "task_completed". */
	eventKey: EventKey;
	className?: string;
};

/** The name stays left to right in an Arabic page: it is code, not a sentence. */
export function EventName({ eventKey, className }: EventNameProps) {
	return (
		<code
			dir="ltr"
			className={cn(
				"rounded-sm bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs",
				className,
			)}
		>
			{eventKey}
		</code>
	);
}
