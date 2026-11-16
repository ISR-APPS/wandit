// The header of the home page: an ivory bar of 64px with the wordmark, the section links, and the telephone.
// LandingPage renders it. The links are anchors of the same page, so they work with no script.
// Below 1024px the links move into the panel of SiteMenu.
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { NAV_LINKS } from "../lib/nav-links";
import { WRAP } from "../lib/type-styles";
import { SiteMenu } from "./site-menu";
import { Wordmark } from "./wordmark";

/** A sticky bar with a hairline under it. No blur and no shadow. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="sticky top-0 z-40 border-foreground/12 border-b bg-background">
			<div
				className={`${WRAP} flex min-h-16 items-center justify-between gap-4`}
			>
				<a href="#top" className="inline-flex min-h-11 items-center">
					<Wordmark className="text-[clamp(0.95rem,1.25vw,1.12rem)]" />
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="hidden items-center gap-[clamp(1.1rem,2vw,2rem)] lg:flex"
				>
					{NAV_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="dlp-underline whitespace-nowrap py-[0.5rem] font-semibold text-[10.5px] text-foreground/75 uppercase leading-none tracking-[0.16em] hover:text-foreground focus-visible:text-foreground"
						>
							{t(link.labelKey)}
						</a>
					))}
				</nav>
				<div className="flex items-center gap-3">
					<LocaleSwitcher />
					{/* A screen under 380px has no room for the number beside the wordmark. The menu panel shows it. */}
					<a
						href={t("site.phoneHref")}
						className="group inline-flex min-h-11 items-center whitespace-nowrap font-display text-[1rem] tracking-[0.01em] max-[379px]:hidden"
					>
						<span className="border-foreground/24 border-b pb-0.5 transition-colors duration-[350ms] group-hover:border-(--dlp-bronze-deep)">
							{t("site.phoneDisplay")}
						</span>
					</a>
					<SiteMenu />
				</div>
			</div>
		</header>
	);
}
