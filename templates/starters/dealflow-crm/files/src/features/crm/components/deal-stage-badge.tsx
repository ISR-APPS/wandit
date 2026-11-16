// The badge of a deal stage: a word and a color.
// The deal list, the deal detail page, and the contact panel render it.
import type { VariantProps } from "class-variance-authority";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge, type badgeVariants } from "~/shared/ui/badge";
import type { DealStage } from "../lib/deal-stage";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Badge variant per stage. Waiting is gray, work in progress is blue, a pending answer is amber, won is green. */
const STAGE_BADGE = {
	lead: "secondary",
	qualified: "info",
	proposal: "warning",
	negotiation: "outline",
	won: "success",
	lost: "outline",
} satisfies Record<DealStage, BadgeVariant>;

/** Tints for the two stages with no tinted kit variant. They follow the recipe of the success and info variants. */
const STAGE_TINT: Partial<Record<DealStage, string>> = {
	// Ink text: a light primary of another look can be under 4.5:1 as text.
	negotiation:
		"border-primary/30 bg-primary/12 text-foreground hover:bg-primary/12",
	lost: "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/10 hover:text-destructive",
};

/** Small dot classes per stage, for a column head or a legend. The same hue as the badge. */
export const STAGE_DOT = {
	lead: "bg-muted-foreground/60",
	qualified: "bg-info",
	proposal: "bg-warning",
	negotiation: "bg-primary",
	won: "bg-success",
	lost: "bg-destructive",
} satisfies Record<DealStage, string>;

type DealStageBadgeProps = {
	stage: DealStage;
	className?: string;
};

/** The translated stage word in the color of the stage. */
export function DealStageBadge({ stage, className }: DealStageBadgeProps) {
	const { t } = useT();
	return (
		<Badge
			variant={STAGE_BADGE[stage]}
			className={cn(STAGE_TINT[stage], className)}
		>
			{t(`stages.${stage}`)}
		</Badge>
	);
}
