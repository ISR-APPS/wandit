// The badge of a deadline priority: the word in a red, amber, or green tint.
// The deadline cards of the dashboard and of the matter page render it.
import type { VariantProps } from "class-variance-authority";
import { useT } from "~/shared/i18n";
import { Badge, type badgeVariants } from "~/shared/ui/badge";
import type { DeadlinePriority } from "../lib/deadline";

/** Badge look per priority. High has no tinted kit variant, so it follows the recipe of the success variant. */
const PRIORITY_BADGE = {
	high: {
		variant: "outline",
		className: "border-destructive/25 bg-destructive/12 text-destructive",
	},
	medium: { variant: "warning", className: "" },
	low: { variant: "success", className: "" },
} satisfies Record<
	DeadlinePriority,
	{ variant: VariantProps<typeof badgeVariants>["variant"]; className: string }
>;

type PriorityBadgeProps = {
	priority: DeadlinePriority;
};

/** The translated priority word. The color is never the only mark. */
export function PriorityBadge({ priority }: PriorityBadgeProps) {
	const { t } = useT();
	const look = PRIORITY_BADGE[priority];
	return (
		<Badge variant={look.variant} className={look.className}>
			{t(`priorities.${priority}`)}
		</Badge>
	);
}
