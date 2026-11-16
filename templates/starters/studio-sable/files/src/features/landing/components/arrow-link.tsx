// The call to action of a text column: a mono link in capitals with an accent hairline and an arrow.
// HeroSection and StudioSection render it. The link is an anchor of the same page.
// The arrow moves 6px on hover and on focus (landing.css, class sable-arrow).

type ArrowLinkProps = {
	/** The anchor of a section of the page, for example "#contact". */
	href: string;
	/** The text of the link, already translated. */
	label: string;
	/** Extra classes of the outer link, for example the cascade class and a top margin. */
	className?: string;
};

/** The touch box is 44px high. The hairline sits 5px under the words, not at the foot of the box. */
export function ArrowLink({ href, label, className = "" }: ArrowLinkProps) {
	return (
		<a
			href={href}
			className={`group inline-flex min-h-11 items-center text-primary transition-colors duration-150 hover:text-foreground focus-visible:text-foreground ${className}`}
		>
			<span className="sable-mono inline-flex items-center gap-2.5 border-primary/40 border-b pb-[5px] text-[12px] uppercase tracking-[0.08em] transition-colors duration-150 group-hover:border-foreground group-focus-visible:border-foreground">
				{label}
				<span aria-hidden="true" className="sable-arrow rtl:-scale-x-100">
					→
				</span>
			</span>
		</a>
	);
}
