/**
 * Shared surface of the cards inside an assistant message: the change card,
 * the suggestion, the approval, and the diff. It also holds the round icon
 * at the start of a card and the two pill looks of the card actions.
 * Rendered by those components under components/chat.
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

/**
 * The round icon at the start of a card. "spark" asks for attention (a
 * saved version, an approval); "neutral" is a quiet proposal.
 */
export function CardMedallion({
	icon: MedallionIcon,
	tone,
}: {
	icon: Icon;
	tone: "spark" | "neutral";
}) {
	return (
		<span
			aria-hidden
			className={cn(
				"grid size-9 shrink-0 place-items-center rounded-full",
				tone === "spark"
					? "bg-spark/[0.18] text-spark-deep dark:bg-spark/[0.14] dark:text-spark"
					: "bg-night/[0.05] text-night/60 dark:bg-white/[0.06] dark:text-foreground/60",
			)}
		>
			<MedallionIcon weight="duotone" className="size-[18px]" />
		</span>
	);
}

/** A quiet 28 px icon button in a card corner (bookmark, copy). Goes on a ghost `icon-sm` kit Button inside IconAction. */
export const CARD_ICON_BUTTON_CLASS =
	"size-7 text-night/45 hover:bg-night/[0.05] hover:text-night dark:text-foreground/45 dark:hover:bg-white/[0.06] dark:hover:text-foreground";

/** The main action of a card ("Accept", "Approve"). Goes on a kit Button with the default ember variant. */
export const CARD_PRIMARY_PILL_CLASS =
	"h-8 px-3.5 font-grotesk font-semibold text-[13px]";

/** A second action of a card ("Deny", "Details"). Goes on a kit Button with the outline variant. */
export const CARD_SECONDARY_PILL_CLASS =
	"h-8 border-night/[0.12] bg-transparent px-3.5 font-grotesk font-medium text-[13px] text-night hover:bg-night/[0.05] hover:text-night dark:border-white/[0.12] dark:bg-transparent dark:text-foreground dark:hover:bg-white/[0.06] dark:hover:text-foreground";
