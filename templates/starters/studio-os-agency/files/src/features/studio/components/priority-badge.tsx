// The priority of a deliverable as a badge: High, Medium, or Low.
// The task board cards and the deliverables table of a project render it. The rule lives in lib/priority.ts.
import type { ComponentProps } from "react";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { Priority } from "../lib/priority";

// High is red, medium amber, low green. The word always shows, so the color is never the only mark.
const PRIORITY_BADGE = {
	high: {
		variant: "outline",
		className: "border-destructive/25 bg-destructive/12 text-destructive",
	},
	medium: { variant: "warning" },
	low: { variant: "success" },
} satisfies Record<Priority, ComponentProps<typeof Badge>>;

/** One priority word in its color. */
export function PriorityBadge({ priority }: { priority: Priority }) {
	const { t } = useT();
	return (
		<Badge {...PRIORITY_BADGE[priority]}>
			{t(`codes.priorities.${priority}`)}
		</Badge>
	);
}
