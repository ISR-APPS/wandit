import { Link } from "@tanstack/react-router";
import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";

import { Logo } from "@/components/logo";
import { LEGAL_COMPANY_REGISTERED_NAME } from "@/features/legal/lib/constants";

import { FOOTER_COLUMNS } from "../lib/constants";
import { useSectionNav } from "../lib/use-section-nav";

const footerLinkClass =
	"rounded-sm text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

// The bottom bar sets its own size and colour; these links only add the states.
const legalLinkClass =
	"rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function LandingFooter() {
	const footer = useDictionary().landing.footer;
	const { t } = useTranslation();
	const navigateToSection = useSectionNav();

	return (
		<footer className="border-border border-t px-4 py-12 md:py-16">
			<div className="mx-auto max-w-6xl">
				<div className="flex flex-col gap-10 md:flex-row md:justify-between">
					<div className="max-w-xs">
						<Logo size="md" />
						<p className="mt-3 text-muted-foreground text-sm leading-relaxed">
							{footer.tagline}
						</p>
					</div>
					<div className="grid grid-cols-2 gap-8 sm:gap-16">
						{FOOTER_COLUMNS.map((column) => (
							<div key={column.id}>
								<h4 className="font-medium font-sans text-foreground text-sm">
									{footer.columnTitles[column.id]}
								</h4>
								<ul className="mt-3 flex flex-col gap-2">
									{column.links.map((link) => (
										<li key={link.key}>
											{link.key === "pricing" ? (
												<Link to="/pricing" className={footerLinkClass}>
													{footer.linkLabels[link.key]}
												</Link>
											) : (
												<a
													href={link.scrollId ? `#${link.scrollId}` : "#"}
													onClick={(e) => {
														if (link.scrollId) {
															e.preventDefault();
															navigateToSection(link.scrollId);
														}
													}}
													className={footerLinkClass}
												>
													{footer.linkLabels[link.key]}
												</a>
											)}
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>
				{/* Google app verification checks that the homepage links to the
				    privacy policy, so these two live in the bottom bar of every page
				    that renders the footer. */}
				<div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-border border-t pt-6 font-mono text-muted-foreground text-xs">
					<span>{footer.copyright}</span>
					<div className="flex flex-wrap items-center gap-4">
						<Link to="/privacy" className={legalLinkClass}>
							{footer.linkLabels.privacy}
						</Link>
						<Link to="/terms" className={legalLinkClass}>
							{footer.linkLabels.terms}
						</Link>
					</div>
					<span>{footer.madeIn}</span>
				</div>
				{/* Meta (and other) business verification looks for the registered
				    legal entity on the website itself, not only in the policies, so
				    the footer names it on every page, spelled as the licence does. */}
				<p className="mt-3 font-mono text-muted-foreground text-xs">
					{t("landing.footer.legalEntity", {
						company: LEGAL_COMPANY_REGISTERED_NAME,
					})}
				</p>
			</div>
		</footer>
	);
}
