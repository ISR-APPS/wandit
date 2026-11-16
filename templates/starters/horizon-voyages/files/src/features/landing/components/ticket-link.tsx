// The boarding-strip action of the HORIZON world: a ticket with a notch on each edge and a torn stub at the end.
// The hero, the journey section, the boarding pass, and the phone menu render it.
// landing.css (.hz-ticket) draws the notches in the ground colour of the section (--hz-notch).
import type { ComponentProps } from "react";
import { cn } from "~/shared/lib/utils";

type TicketLinkProps = ComponentProps<"a"> & {
	/** An anchor, a tel: link, or a mailto: link. The ticket never posts data. */
	href: string;
	/** Two or three characters after the dashed tear, for example "HV". Decorative, hidden from screen readers. */
	code: string;
	/** "sun" is the one filled action of a view. "ghost" is the hairline variant with the same notches. */
	tone?: "sun" | "ghost";
};

/**
 * A link drawn as a ticket. The touch area is about 50px high.
 * It passes the other anchor props on, so a kit SheetClose can wrap it with asChild.
 */
export function TicketLink({
	code,
	tone = "sun",
	className,
	children,
	...anchorProps
}: TicketLinkProps) {
	return (
		<a
			{...anchorProps}
			className={cn(
				"hz-ticket font-sans font-semibold text-[12px] uppercase leading-none tracking-[0.15em] max-[429px]:text-[11px]",
				className,
			)}
			data-tone={tone}
		>
			<span className="hz-ticket-main">{children}</span>
			<span className="hz-ticket-code" aria-hidden="true">
				{code}
			</span>
		</a>
	);
}
