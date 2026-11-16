// The sticky header of the home page: the wordmark, the section links, and the "Open a study" action.
// LandingPage renders it. Below 1024px the links move into SiteMenu, the phone menu.
// It has a paper ground and one ink rule at the bottom: no blur, no shadow, no shrink.
import { useT } from "~/shared/i18n";
import { CONTACT_HREF, SECTION_LINKS } from "../lib/content";
import { BUTTON_PRIMARY, LABEL } from "../lib/styles";
import { SiteMenu } from "./site-menu";
import { Wordmark } from "./wordmark";

/** The bar is 56px tall on a phone and 72px from 1024px, the --ns-bar value of landing.css. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="sticky top-0 z-40 border-foreground border-b-[1.5px] bg-background">
			<div className="ns-wrap flex h-(--ns-bar) items-center justify-between gap-6">
				<a
					href="#top"
					className="flex min-h-11 items-center text-[1.15rem] lg:text-[1.25rem]"
				>
					<Wordmark withMeta />
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="hidden items-center gap-7 lg:flex"
				>
					{SECTION_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className={`${LABEL} ns-underline whitespace-nowrap pb-0.5 text-foreground`}
						>
							{t(link.label)}
						</a>
					))}
					<a href={CONTACT_HREF} className={`${BUTTON_PRIMARY} min-h-11 px-5`}>
						{t("nav.cta")}
					</a>
				</nav>
				<SiteMenu />
			</div>
		</header>
	);
}
