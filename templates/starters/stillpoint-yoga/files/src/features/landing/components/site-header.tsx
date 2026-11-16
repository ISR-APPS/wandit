// The fixed header of the home page: the breathing mark and wordmark, five section links, and the reserve button.
// LandingPage renders it. It is clear over the hero and turns into a blurred bone bar once the page scrolls.
// Below 1024px the links move into the panel of SiteMenu.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useScrolled } from "../hooks/use-scrolled";
import { NAV_LINKS } from "../lib/nav-links";
import { INK_BUTTON } from "../lib/styles";
import { BrandMark } from "./brand-mark";
import { SiteMenu } from "./site-menu";

/** The header. The links are anchors of the same page, so they work with no script. */
export function SiteHeader() {
	const { t } = useT();
	const isScrolled = useScrolled();
	return (
		<header
			data-scrolled={isScrolled}
			className="sp-header fixed inset-x-0 top-0 z-40"
		>
			<div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-6 px-[clamp(16px,5vw,72px)] py-3 lg:py-[18px]">
				<a
					href="#top"
					aria-label={t("site.brandHome")}
					className="flex min-h-11 items-center gap-[11px] font-display font-normal text-[1.32rem] leading-none tracking-[-0.01em] no-underline"
				>
					<BrandMark />
					{t("site.brand")}
				</a>
				<nav aria-label={t("site.navLabel")} className="hidden lg:block">
					<ul className="m-0 flex list-none items-center gap-[clamp(16px,2.2vw,32px)] p-0">
						{NAV_LINKS.map((link) => (
							<li key={link.href}>
								<a
									href={link.href}
									className="sp-navlink relative inline-flex min-h-11 items-center whitespace-nowrap font-sans font-semibold text-(--sp-ink-78) text-[0.8rem] uppercase tracking-[0.08em] no-underline transition-colors duration-500 hover:text-foreground"
								>
									{t(link.labelKey)}
								</a>
							</li>
						))}
					</ul>
				</nav>
				<div className="flex items-center gap-2">
					<a
						href="#begin"
						className={cn(
							INK_BUTTON,
							"px-4 py-2.5 text-[0.74rem] sm:px-5 sm:text-[0.8rem]",
						)}
					>
						{t("site.reserveCta")}
					</a>
					<SiteMenu />
				</div>
			</div>
		</header>
	);
}
