// The priority of a ticket as a Badge: urgent in a red tint, high amber, normal blue, low plain.
// The home table, the ticket list, and the ticket thread render it.
import type { VariantProps } from "class-variance-authority";
import { useT } from "~/shared/i18n";
import { Badge, type badgeVariants } from "~/shared/ui/badge";
import type { TicketPriority } from "../lib/ticket-rules";

/** Badge look per priority. Urgent has no tinted kit variant, so it follows the recipe of the success variant. */
const PRIORITY_BADGE = {
	urgent: {
		variant: "outline",
		className: "border-destructive/25 bg-destructive/12 text-destructive",
	},
	high: { variant: "warning", className: "" },
	normal: { variant: "info", className: "" },
	low: { variant: "outline", className: "" },
} satisfies Record<
	TicketPriority,
	{ variant: VariantProps<typeof badgeVariants>["variant"]; className: string }
>;

type PriorityBadgeProps = {
	priority: TicketPriority;
};

/** The translated priority word. The color is never the only mark. */
export function PriorityBadge({ priority }: PriorityBadgeProps) {
	const { t } = useT();
	const look = PRIORITY_BADGE[priority];
	return (
		<Badge variant={look.variant} className={look.className}>
			{t(`tickets.priorities.${priority}`)}
		</Badge>
	);
}
