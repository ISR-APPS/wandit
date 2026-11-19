// The priority of a task as a word in a tinted badge: red for urgent and high, amber for medium, green for low.
// The reminder cards of the home and the board cards of a project render it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import type { TaskPriority } from "../lib/codes";

// The kit Badge has no tinted destructive variant, so urgent and high get the tint by class.
const DESTRUCTIVE_TINT =
	"border-destructive/25 bg-destructive/12 text-destructive";

const PRIORITY_LOOK = {
	urgent: { variant: "outline", className: DESTRUCTIVE_TINT },
	high: { variant: "outline", className: DESTRUCTIVE_TINT },
	medium: { variant: "warning", className: "" },
	low: { variant: "success", className: "" },
} as const satisfies Record<
	TaskPriority,
	{ variant: "outline" | "warning" | "success"; className: string }
>;

/** The word always shows, so the priority never depends on the color alone. */
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
	const { t } = useT();
	const look = PRIORITY_LOOK[priority];
	return (
		<Badge variant={look.variant} className={cn(look.className)}>
			{t(`priority.${priority}`)}
		</Badge>
	);
}
