// The statuses of an invoice and the Badge variant of each one.
// The billing page, the invoice dialog, the matter detail page, and the client sheet read this file.
// The sample tables derive the status from the due date and the payments (sample-data.ts).
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every status, in the order of the tabs of the billing page. */
export const INVOICE_STATUSES = ["sent", "partial", "overdue", "paid"] as const;

/** One status. Its label is the message key `invoiceStatus.<status>`. */
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Badge variant per status. Overdue is the only red one, paid the only green one. */
export const INVOICE_STATUS_BADGE = {
	sent: "info",
	partial: "warning",
	overdue: "destructive",
	paid: "success",
} satisfies Record<InvoiceStatus, BadgeVariant>;
