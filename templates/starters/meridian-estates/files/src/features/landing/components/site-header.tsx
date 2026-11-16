// The fixed header of the home page: the letterspaced wordmark, the section links, and the viewing pill.
// LandingPage renders it. It is transparent over the hero, turns into a blurred band after a short scroll,
// and hides while the visitor scrolls down (use-header-state.ts). On a phone SiteMenu holds the links.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { useHeaderState } from "../hooks/use-header-state";
import { SECTION_LINKS } from "../lib/content";
import { SiteMenu } from "./site-menu";

/** The top bar. Every link is an anchor of the page; the pill leads to the viewing note. */
export function SiteHeader() {
	const { t } = useT();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const state = useHeaderState(isMenuOpen);
	return (
		<header
			data-state={state}
			className="mer-header mer-gutter fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-6 border-transparent border-b py-4 lg:py-5"
		>
			<a
				href="#top"
				className="flex min-h-11 items-center font-semibold text-[0.875rem] text-foreground uppercase tracking-[0.34em]"
			>
				{t("site.wordmark")}
				<em className="-ms-[0.2em] font-display font-normal text-[1.125rem] text-primary normal-case tracking-normal">
					.
				</em>
			</a>
			<nav aria-label={t("nav.label")} className="hidden md:block">
				<ul className="flex items-center gap-10">
					{SECTION_LINKS.map((link) => (
						<li key={link.id}>
							<a
								href={`#${link.id}`}
								className="mer-underline py-1.5 text-[0.75rem] text-foreground/65 uppercase tracking-[0.16em] transition-colors duration-300 hover:text-foreground"
							>
								{t(link.label)}
							</a>
						</li>
					))}
				</ul>
			</nav>
			<a
				href="#contact"
				className="hidden whitespace-nowrap rounded-full border border-primary/55 px-6 py-3 text-[0.6875rem] text-primary uppercase tracking-[0.2em] transition-colors duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground md:inline-block"
			>
				{t("nav.cta")}
			</a>
			<SiteMenu open={isMenuOpen} onOpenChange={setIsMenuOpen} />
		</header>
	);
}
