// The status word of one entry, in a Badge: pending, posted, or returned.
// The entry tables of every page, the entry page, and its history table render it.
import type { VariantProps } from "class-variance-authority";
import { useT } from "~/shared/i18n";
import { Badge, type badgeVariants } from "~/shared/ui/badge";
import type { TransactionStatus } from "../lib/sample-transactions";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

// Posted is the normal end state, so it stays quiet. Pending is in progress. Returned failed.
const STATUS_BADGE = {
	pending: "info",
	posted: "outline",
	returned: "destructive",
} satisfies Record<TransactionStatus, BadgeVariant>;

type TransactionStatusBadgeProps = {
	status: TransactionStatus;
};

/** The word carries the meaning; the color only repeats it. */
export function TransactionStatusBadge({
	status,
}: TransactionStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={STATUS_BADGE[status]}>{t(`statuses.${status}`)}</Badge>
	);
}
