// The live status of a table and of a check, and the look of each: the dot color and the Badge variant.
// The order screen reads the table dots. The orders list, the home, the report, and the check page read the check badges.
// A status always shows as a dot or a badge plus its word, never as a color alone.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";
import type { OrderStatus } from "./sample-orders";

/** The table statuses in the order of a meal. */
export const TABLE_STATUSES = [
	"seated",
	"ordered",
	"served",
	"bill",
	"reserved",
	"free",
] as const;

/** One table status. Its label is the message key `tableStatuses.<status>`. */
export type TableStatus = (typeof TABLE_STATUSES)[number];

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/**
 * Dot class per table status. A free table has a hollow dot, so it reads as empty.
 * Seated takes chart-4: warning and primary are close hues in warm looks, and the bill already takes primary.
 */
export const TABLE_STATUS_DOT = {
	seated: "bg-chart-4",
	ordered: "bg-info",
	served: "bg-success",
	bill: "bg-primary",
	reserved: "bg-muted-foreground",
	free: "border border-muted-foreground",
} satisfies Record<TableStatus, string>;

/**
 * Badge variant per order status. The colors match the table statuses of the same step.
 * A paid check is closed, so it is the quiet outline one: the open checks stand out in the list.
 */
export const ORDER_STATUS_BADGE = {
	in_kitchen: "info",
	served: "success",
	bill: "default",
	paid: "outline",
	void: "destructive",
} satisfies Record<OrderStatus, BadgeVariant>;
