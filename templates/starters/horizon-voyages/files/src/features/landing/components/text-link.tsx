// The second action of the page: tracked capitals with a sun underline that extends from the start edge.
// The hero, the circuit cards, and the boarding pass render it. landing.css (.hz-underline) draws the hover and focus line.
import type { ReactNode } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type TextLinkProps = {
	href: string;
	/** The link text, already translated. */
	children: ReactNode;
	className?: string;
};

/** A link of at least 44px high. The arrow turns in a right-to-left page. */
export function TextLink({ href, children, className }: TextLinkProps) {
	const { t } = useT();
	return (
		<a
			href={href}
			className={cn(
				"inline-flex min-h-11 items-center font-semibold text-[12px] text-foreground uppercase leading-none tracking-[0.14em]",
				className,
			)}
		>
			<span className="hz-underline inline-flex items-center gap-[9px] py-[5px]">
				{children}
				<span aria-hidden="true" className="inline-block rtl:rotate-180">
					{t("site.arrow")}
				</span>
			</span>
		</a>
	);
}
