// The masthead of the page: the wordmark, the four section links, and one mono line with the city and the availability.
// LandingPage renders it. The links are anchors of the same page, so they work with no script.
// Below 640px the links move into the panel of SiteMenu.
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { NAV_LINKS } from "../lib/nav-links";
import { MONO, WRAP } from "../lib/type-styles";
import { SiteMenu } from "./site-menu";
import { Wordmark } from "./wordmark";

/** A plain bar of 68px with one hairline under it. It is not sticky: the index must own the first screen. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="relative z-30 border-foreground/14 border-b bg-background">
			<div
				className={`${WRAP} flex min-h-[68px] items-center gap-[clamp(16px,3vw,48px)]`}
			>
				<a
					href="#top"
					className="inline-flex h-11 items-center whitespace-nowrap font-display font-medium text-[19px] tracking-[-0.03em]"
				>
					<Wordmark />
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="ms-auto hidden gap-[clamp(14px,2vw,30px)] text-[15px] tracking-[-0.01em] sm:flex"
				>
					{NAV_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="group inline-flex h-11 items-center whitespace-nowrap transition-colors duration-150 hover:text-primary focus-visible:text-primary"
						>
							<span className="border-transparent border-b py-1.5 transition-colors duration-150 group-hover:border-primary group-focus-visible:border-primary">
								{t(link.labelKey)}
							</span>
						</a>
					))}
				</nav>
				<LocaleSwitcher />
				<p
					className={`${MONO} hidden whitespace-nowrap text-foreground/55 min-[861px]:block`}
				>
					{t("site.availability")}
				</p>
				<SiteMenu />
			</div>
		</header>
	);
}
