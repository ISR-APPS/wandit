// The live status of a table and the look of each status: the Badge variant and the dot color.
// The floor wall, the table panel, the order screen, and the orders list read this file.
// A status always shows as a dot or a badge plus its word, never as a color alone.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";
import type { OrderStatus } from "./sample-orders";

/** The table statuses in the order of a meal. The status line of the floor follows this order. */
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

/** Badge variant per table status. Seated waits for an order, so it is the warning one. The bill is the money moment. */
export const TABLE_STATUS_BADGE = {
	seated: "warning",
	ordered: "info",
	served: "success",
	bill: "default",
	reserved: "secondary",
	free: "outline",
} satisfies Record<TableStatus, BadgeVariant>;

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
