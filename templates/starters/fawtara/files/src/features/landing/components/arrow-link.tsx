// The third action level of the page: a blue text link with an arrow.
// Each panel of ProductSection ends with one, and FaqSection has one. landing.css moves the arrow 4px on hover.
import type { ReactNode } from "react";
import { ArrowRightIcon } from "~/shared/ui/icons";

type ArrowLinkProps = {
	/** A hash of the page, for example "#pricing". */
	href: string;
	/** The text of the link. It names where the link goes. */
	children: ReactNode;
};

/** The link box is 44px high for a finger. The arrow turns in Arabic. */
export function ArrowLink({ href, children }: ArrowLinkProps) {
	return (
		<a
			href={href}
			className="fw-arrow-link inline-flex min-h-11 items-center gap-1.5 font-display font-semibold text-[0.95rem] text-primary tracking-normal"
		>
			{children}
			<ArrowRightIcon className="fw-arrow rtl:rotate-180" />
		</a>
	);
}
