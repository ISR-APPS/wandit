// The Badge variant of each transaction status.
// TransactionStatusBadge reads it. The statuses themselves live in sample-transactions.ts.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";
import type { TransactionStatus } from "./sample-transactions";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Pending is the only amber one: it still needs the bank. Reconciled is quiet: nothing is left to do. */
export const TRANSACTION_STATUS_BADGE = {
	pending: "warning",
	cleared: "info",
	reconciled: "outline",
} satisfies Record<TransactionStatus, BadgeVariant>;
