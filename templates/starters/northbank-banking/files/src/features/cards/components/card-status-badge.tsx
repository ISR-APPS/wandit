// The status word of one card, in a Badge: active, frozen, or cancelled.
// The cards table, the card page, and the other-cards list render it.
import type { VariantProps } from "class-variance-authority";
import type { CardStatus } from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Badge, type badgeVariants } from "~/shared/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

// A frozen card needs a decision soon: unfreeze it or cancel it. A cancelled card is closed for good.
const CARD_STATUS_BADGE = {
	active: "success",
	frozen: "warning",
	cancelled: "outline",
} satisfies Record<CardStatus, BadgeVariant>;

type CardStatusBadgeProps = {
	status: CardStatus;
};

/** The word carries the meaning; the color only repeats it. */
export function CardStatusBadge({ status }: CardStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={CARD_STATUS_BADGE[status]}>
			{t(`cards.statuses.${status}`)}
		</Badge>
	);
}
