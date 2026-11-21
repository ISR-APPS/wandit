// The badge of a task priority: the word in a red, amber, or green tint.
// The follow-up card of the home, the follow-up table of the Activities page, and the task lists render it.
import type { VariantProps } from "class-variance-authority";
import { useT } from "~/shared/i18n";
import { Badge, type badgeVariants } from "~/shared/ui/badge";
import type { TaskPriority } from "../lib/task";

/** Badge look per priority. High has no tinted kit variant, so it follows the recipe of the success variant. */
const PRIORITY_BADGE = {
	high: {
		variant: "outline",
		className: "border-destructive/25 bg-destructive/12 text-destructive",
	},
	medium: { variant: "warning", className: "" },
	low: { variant: "success", className: "" },
} satisfies Record<
	TaskPriority,
	{ variant: VariantProps<typeof badgeVariants>["variant"]; className: string }
>;

type PriorityBadgeProps = {
	priority: TaskPriority;
};

/** The translated priority word. The color is never the only mark. */
export function PriorityBadge({ priority }: PriorityBadgeProps) {
	const { t } = useT();
	const look = PRIORITY_BADGE[priority];
	return (
		<Badge variant={look.variant} className={look.className}>
			{t(`tasks.priorities.${priority}`)}
		</Badge>
	);
}
