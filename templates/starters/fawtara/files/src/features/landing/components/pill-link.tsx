// The pill action of the landing page: a link that looks like a button.
// The header, the phone menu, the hero, the price cards, and the contact card render it.
// landing.css gives the blue gradient of the primary tone (class fw-cta).
import type { ComponentProps } from "react";
import { cn } from "~/shared/lib/utils";

type PillLinkProps = ComponentProps<"a"> & {
	/** A hash of the page, a `tel:` link, or a `mailto:` link. */
	href: string;
	/** "primary" is the one main action of a view. "secondary" is the white pill with a blue edge. */
	tone: "primary" | "secondary";
};

/**
 * 48px high, so a finger can press it. The text is the display face at weight 600.
 * The other anchor props pass through, so SheetClose can add its click handler.
 */
export function PillLink({ tone, className, ...anchorProps }: PillLinkProps) {
	return (
		<a
			{...anchorProps}
			className={cn(
				"inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-7 text-center font-display font-semibold text-[0.96rem] tracking-normal",
				tone === "primary"
					? "fw-cta text-primary-foreground"
					: "border-[1.5px] border-primary/35 bg-card text-primary transition-colors hover:bg-accent",
				className,
			)}
		/>
	);
}
