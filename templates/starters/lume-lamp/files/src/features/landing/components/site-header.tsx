// The sticky header: the wordmark, the four section links, and the "Reserve" pill.
// LandingPage renders it. It takes the colorway ground through landing.css, and blurs after a 32px scroll.
// Below 860px the links move into the panel of SiteMenu.
import { useT } from "~/shared/i18n";
import { useIsScrolled } from "../hooks/use-is-scrolled";
import { NAV_LINKS } from "../lib/nav-links";
import { WRAP } from "../lib/type-styles";
import { PillArrow } from "./pill-arrow";
import { SiteMenu } from "./site-menu";
import { Wordmark } from "./wordmark";

/** About 72px tall. The section anchors stop 4.5rem lower, under it. */
export function SiteHeader() {
	const { t } = useT();
	const isScrolled = useIsScrolled();
	return (
		<header
			className="lume-header sticky top-0 z-40"
			data-scrolled={isScrolled}
		>
			<div className={`${WRAP} flex items-center gap-8 py-3.5`}>
				<a
					href="#top"
					aria-label={t("site.homeLabel")}
					className="flex min-h-11 items-center"
				>
					<Wordmark />
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="ms-auto hidden min-[860px]:block"
				>
					<ul className="flex gap-[1.9rem]">
						{NAV_LINKS.map((link) => (
							<li key={link.href}>
								<a
									href={link.href}
									className="flex min-h-11 items-center whitespace-nowrap font-medium text-[0.9rem] tracking-[0.02em] opacity-85 transition-opacity duration-300 hover:opacity-100"
								>
									{t(link.labelKey)}
								</a>
							</li>
						))}
					</ul>
				</nav>
				<div className="ms-auto flex items-center gap-1 min-[860px]:ms-0">
					<a href="#reserve" className="lume-btn lume-btn-small lume-btn-stage">
						{t("site.reserve")}
						<PillArrow />
					</a>
					<SiteMenu />
				</div>
			</div>
		</header>
	);
}
