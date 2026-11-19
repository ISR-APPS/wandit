// The badge of an order that is not shipped yet: to pack, packed, or late.
// The home delivery card and the status cell of the order table render it.
import type { BadgeVariant, ShelfStage } from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";

/** Late is the only red one: it is the order that the team must ship first. */
const SHELF_STAGE_BADGE = {
	to_pack: "warning",
	packed: "info",
	late: "destructive",
} satisfies Record<ShelfStage, BadgeVariant>;

type ShelfStageBadgeProps = {
	/** The result of shelfStageOf for an order to ship. */
	stage: ShelfStage;
};

/** A word plus a color, never a color alone. */
export function ShelfStageBadge({ stage }: ShelfStageBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={SHELF_STAGE_BADGE[stage]}>
			{t(`orders.stages.${stage}`)}
		</Badge>
	);
}
