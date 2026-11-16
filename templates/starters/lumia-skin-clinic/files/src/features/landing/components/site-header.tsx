// The header of the home page: the serif wordmark, four plain section links, and one bronze capsule.
// LandingPage renders it. It sits on the cream with no bar, no blur, and no shadow, as the Éclat world asks.
// Below 1024px the links move into the panel of SiteMenu. From 640px the telephone capsule stays beside it.
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { NAV_LINKS } from "../lib/nav-links";
import {
	GHOST_CAPSULE,
	GUTTER,
	PRIMARY_CAPSULE,
	WRAP,
} from "../lib/type-styles";
import { SiteMenu } from "./site-menu";

/** The header bar. The links are anchors of the same page, so they work with no script. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className={`${GUTTER} relative z-20 pt-[1.15rem] pb-3`}>
			<div
				className={`${WRAP} flex min-h-14 items-center gap-[clamp(1rem,3vw,2.8rem)]`}
			>
				<a
					href="#top"
					aria-label={t("site.brandHome")}
					className="inline-flex min-h-11 shrink-0 items-center font-display text-[clamp(1.3rem,2vw,1.5rem)] leading-none no-underline"
				>
					{t("site.brand")}
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="ms-auto hidden lg:block"
				>
					<ul className="m-0 flex list-none items-center gap-[clamp(1.1rem,2.3vw,2rem)] p-0">
						{NAV_LINKS.map((link) => (
							<li key={link.href}>
								<a
									href={link.href}
									className="inline-flex min-h-11 items-center whitespace-nowrap font-semibold text-(--lumia-ink-soft) text-[14px] no-underline transition-colors duration-[350ms] hover:text-(--lumia-bronze-deep) focus-visible:text-(--lumia-bronze-deep)"
								>
									{t(link.labelKey)}
								</a>
							</li>
						))}
					</ul>
				</nav>
				<LocaleSwitcher />
				<a
					href="#contact"
					className={cn(
						PRIMARY_CAPSULE,
						"hidden min-h-11 px-[26px] py-[13px] text-[13px] lg:inline-flex",
					)}
				>
					{t("hero.cta")}
				</a>
				<div className="ms-auto flex items-center gap-3 lg:hidden">
					<a
						href={t("site.phoneHref")}
						className={cn(
							GHOST_CAPSULE,
							"hidden min-h-11 px-5 py-2 text-[13px] tracking-[0.04em] sm:inline-flex",
						)}
					>
						{t("site.phoneDisplay")}
					</a>
					<SiteMenu />
				</div>
			</div>
		</header>
	);
}
