// The priority of a ticket as a word with a colored mark: urgent red, high amber, normal blue, low muted.
// The queue, the ticket list, Next up, and the ticket page render it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { TicketPriority } from "../lib/ticket-rules";

/** The mark color per priority. The word always shows too, so color is never the only signal. */
const PRIORITY_MARK = {
	urgent: "bg-destructive",
	high: "bg-warning",
	normal: "bg-info",
	low: "bg-muted-foreground/50",
} satisfies Record<TicketPriority, string>;

type PriorityLabelProps = {
	priority: TicketPriority;
};

/** A small square mark and the translated priority. Urgent also gets a medium weight. */
export function PriorityLabel({ priority }: PriorityLabelProps) {
	const { t } = useT();
	return (
		<span
			className={cn(
				"inline-flex items-center gap-2 whitespace-nowrap text-sm",
				priority === "urgent" && "font-medium",
			)}
		>
			<span
				aria-hidden="true"
				className={cn("size-2 shrink-0 rounded-xs", PRIORITY_MARK[priority])}
			/>
			{t(`tickets.priorities.${priority}`)}
		</span>
	);
}
