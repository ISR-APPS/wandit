// The header of the page: the wordmark, the five section links, and the basket chip. It stays at the top of the screen.
// LandingPage renders it. The links are anchors of the same page, so they work with no script.
// Below 900px the links move into the panel of SiteMenu.
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { NAV_LINKS } from "../lib/nav-links";
import { WRAP } from "../lib/type-styles";
import { BasketLink } from "./basket-link";
import { SiteMenu } from "./site-menu";
import { Wordmark } from "./wordmark";

/** A white bar of 64px with one hairline under it. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="sticky top-0 z-40 border-foreground/16 border-b bg-background">
			<div
				className={`${WRAP} flex h-16 items-center gap-[clamp(10px,2.4vw,34px)]`}
			>
				<a href="#top" className="flex h-11 flex-none items-center">
					<Wordmark />
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="ms-auto hidden gap-[clamp(14px,1.8vw,26px)] min-[900px]:flex"
				>
					{NAV_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="group flex h-11 items-center whitespace-nowrap"
						>
							<span className="nour-mono border-transparent border-b py-1.5 text-[11px] text-muted-foreground uppercase tracking-[0.1em] transition-colors duration-300 group-hover:border-foreground group-hover:text-foreground group-focus-visible:border-foreground group-focus-visible:text-foreground">
								{t(link.labelKey)}
							</span>
						</a>
					))}
				</nav>
				<LocaleSwitcher />
				<div className="ms-auto flex items-center gap-1.5 min-[900px]:ms-0">
					<BasketLink />
					<SiteMenu />
				</div>
			</div>
		</header>
	);
}
