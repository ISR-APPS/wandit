// The header of the public page: a cream bar with the wordmark, the section links, and the order telephone.
// LandingPage renders it. The links are anchors of the same page, so they work with no script.
// Under 1024px the links move into the panel of SiteMenu.
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { NAV_LINKS } from "../lib/content";
import { BUTTON, BUTTON_HOT, DISPLAY_TEXT, WRAP } from "../lib/type-styles";
import { SiteMenu } from "./site-menu";

/** Sticky bar, 60px high with its 2px ink edge. landing.css holds the same height as --sc-bar. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="sticky top-0 z-40 border-foreground border-b-2 bg-background">
			<div
				className={cn(
					WRAP,
					"flex h-14.5 items-center gap-[clamp(10px,2vw,26px)]",
				)}
			>
				<a
					href="#top"
					className={cn(
						DISPLAY_TEXT,
						"inline-flex h-11 items-center text-[clamp(26px,2.4vw,30px)] leading-none tracking-[0.01em]",
					)}
				>
					{t("site.brand")}
					<span className="text-primary">!</span>
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="ms-auto hidden gap-[clamp(14px,1.7vw,24px)] font-bold text-xs uppercase tracking-[0.09em] lg:flex"
				>
					{NAV_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="whitespace-nowrap border-transparent border-b-2 py-1.5 transition-colors duration-150 hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary"
						>
							{t(link.labelKey)}
						</a>
					))}
				</nav>
				<LocaleSwitcher />
				{/* The order verb leaves on a narrow phone. The number never does. */}
				<a
					href={t("site.phoneHref")}
					className={cn(
						BUTTON,
						BUTTON_HOT,
						"ms-auto min-h-11 gap-0 whitespace-nowrap px-4 text-xs lg:ms-0",
					)}
				>
					<span className="hidden min-[420px]:inline">
						{t("site.orderVerb")} ·{"\u00a0"}
					</span>
					{t("site.phoneDisplay")}
				</a>
				<SiteMenu />
			</div>
		</header>
	);
}
