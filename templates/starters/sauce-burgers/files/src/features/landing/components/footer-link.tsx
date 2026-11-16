// One link of the footer: a text with a 2px accent line under it.
// SiteFooter renders it for the telephone and for the two menu anchors.

type FooterLinkProps = {
	/** An anchor of the page, such as "#menu", or a tel: link. */
	href: string;
	/** The translated link text. */
	label: string;
};

/** The line sits on the text. The padding around it makes the touch area 44px high. */
export function FooterLink({ href, label }: FooterLinkProps) {
	return (
		<a
			href={href}
			className="inline-block py-2.5 hover:text-(--sc-mustard) focus-visible:text-(--sc-mustard)"
		>
			<span className="border-primary border-b-2">{label}</span>
		</a>
	);
}
