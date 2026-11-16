// The Badge variant and the bar fill of each budget status.
// The budget rows and the budget sheet read them.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";
import type { BudgetStatus } from "./budget-report";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Over is the only red one. Ahead of pace is amber: the month can still end inside the limit. */
export const BUDGET_STATUS_BADGE = {
	over: "destructive",
	ahead: "warning",
	within: "secondary",
} satisfies Record<BudgetStatus, BadgeVariant>;

/** The fill class of the budget bar for each status. */
export const BUDGET_STATUS_FILL = {
	over: "bg-destructive",
	ahead: "bg-warning",
	within: "bg-chart-1",
} satisfies Record<BudgetStatus, string>;
