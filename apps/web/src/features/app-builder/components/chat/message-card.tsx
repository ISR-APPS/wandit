/**
 * Shared surface of the builder cards: the approval card in an assistant
 * message and the diff card of a version. Rendered by approval-card.tsx and
 * diff-card.tsx. It also holds the round icon at the start of a card and the
 * pill looks of the card actions, so every card lifts the same way.
 */

import type { Icon } from "@phosphor-icons/react";
import { cn } from "@wandit/ui/lib/utils";
import type { ComponentProps } from "react";

/** A card of the thread: a white face with a navy hairline. Dark: a faint lift with a white hairline. */
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

/** The round spark icon at the start of a card. The spark tint asks for attention (an approval). */
export function CardMedallion({ icon: MedallionIcon }: { icon: Icon }) {
	return (
		<span
			aria-hidden
			className="grid size-9 shrink-0 place-items-center rounded-full bg-spark/[0.18] text-spark-deep dark:bg-spark/[0.14] dark:text-spark"
		>
			<MedallionIcon weight="duotone" className="size-[18px]" />
		</span>
	);
}

/** A quiet 28 px icon button in a card corner (copy). Goes on a ghost `icon-sm` kit Button inside IconAction. */
export const CARD_ICON_BUTTON_CLASS =
	"size-7 text-night/45 hover:bg-night/[0.05] hover:text-night dark:text-foreground/45 dark:hover:bg-white/[0.06] dark:hover:text-foreground";

/** The main action of a card ("Approve"). Goes on a kit Button with the default ember variant. */
export const CARD_PRIMARY_PILL_CLASS =
	"h-8 px-3.5 font-grotesk font-semibold text-[13px]";

/** A second action of a card ("Deny") or of the turn error ("Retry"). Goes on a kit Button with the outline variant. */
export const CARD_SECONDARY_PILL_CLASS =
	"h-8 border-night/[0.12] bg-transparent px-3.5 font-grotesk font-medium text-[13px] text-night hover:bg-night/[0.05] hover:text-night dark:border-white/[0.12] dark:bg-transparent dark:text-foreground dark:hover:bg-white/[0.06] dark:hover:text-foreground";
