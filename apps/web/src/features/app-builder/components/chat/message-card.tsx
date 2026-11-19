/**
 * Shared surface of the builder cards in the thread. Rendered by
 * approval-card.tsx, diff-card.tsx, plan-card.tsx, and
 * security-report-card.tsx. It also holds the round icon at the start of a
 * card and the looks of the card action pills. So every card looks the same.
 */

import type { Icon } from "@phosphor-icons/react";
import { cn } from "@wandit/ui/lib/utils";
import type { ComponentProps } from "react";

/** A card of the thread: a white sheet with a navy hairline and no shadow. Dark: a faint white fill with a white hairline. */
export function MessageCard({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"rounded-[20px] border border-night/[0.08] bg-white p-3.5 dark:border-white/[0.08] dark:bg-white/[0.04]",
				className,
			)}
			{...props}
		/>
	);
}

/** The round 32 px spark icon at the start of a card. The spark tint asks for attention (an approval). */
export function CardMedallion({ icon: MedallionIcon }: { icon: Icon }) {
	return (
		<span
			aria-hidden
			className="grid size-8 shrink-0 place-items-center rounded-full bg-spark/[0.18] text-spark-deep dark:bg-spark/[0.14] dark:text-spark"
		>
			<MedallionIcon weight="duotone" className="size-[18px]" />
		</span>
	);
}

/** A quiet 28 px icon button in a card corner (copy). Goes on a ghost `icon-sm` kit Button inside IconAction. */
export const CARD_ICON_BUTTON_CLASS =
	"size-7 text-night/45 hover:bg-night/[0.05] hover:text-night dark:text-foreground/45 dark:hover:bg-white/[0.06] dark:hover:text-foreground";

/** The main action of a card ("Approve"): a pill, 28 px high. Goes on a kit Button with the default ember variant. */
export const CARD_PRIMARY_BUTTON_CLASS =
	"h-7 px-3 font-grotesk font-medium text-[13px] active:translate-y-px";

/** A second action of a card ("Deny") or of the turn error ("Retry"): a flat white pill, 28 px high. Goes on a kit Button with the outline variant. */
export const CARD_SECONDARY_BUTTON_CLASS =
	"h-7 border-night/[0.12] bg-white px-3 font-grotesk font-medium text-[13px] text-night hover:bg-night/[0.04] hover:text-night dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-foreground dark:hover:bg-white/[0.08] dark:hover:text-foreground";
