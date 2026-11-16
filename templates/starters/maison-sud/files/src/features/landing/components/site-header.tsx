// The header of the public page: a chalk bar with the wordmark, the section links, and the telephone.
// LandingPage renders it. The links are anchors of the same page, so they work with no script.
// On a phone the section links are a second row of the bar.
import { LocaleSwitcher, type TranslationKey, useT } from "~/shared/i18n";
import { WRAP } from "../lib/type-styles";

// Each href is the id of a section element. Each section file sets its own id.
const NAV_LINKS: readonly { href: string; labelKey: TranslationKey }[] = [
	{ href: "#projects", labelKey: "site.navProjects" },
	{ href: "#method", labelKey: "site.navMethod" },
	{ href: "#rooms", labelKey: "site.navRooms" },
	{ href: "#materials", labelKey: "site.navMaterials" },
	{ href: "#contact", labelKey: "site.navContact" },
];

/** Sticky top bar: 60px from 768px, two rows and 98px on a phone. Each link is 44px high for a finger. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="sticky top-0 z-40 border-foreground/10 border-b bg-card">
			<div
				className={`${WRAP} flex flex-wrap items-center gap-x-5 md:h-15 md:flex-nowrap`}
			>
				<a
					href="#top"
					className="inline-flex h-13 items-center whitespace-nowrap font-display text-[1.14rem] tracking-[0.01em] md:h-11"
				>
					{t("site.brandFirst")}
					{"\u00a0"}
					<span className="text-primary">{t("site.brandSecond")}</span>
				</a>
				{/* On a phone the links take the whole second row. The smaller type lets the five links fit a 360px screen.
				    A row wider than the screen scrolls sideways. */}
				<nav
					aria-label={t("site.navLabel")}
					className="order-3 flex w-full justify-between gap-x-2 overflow-x-auto border-foreground/10 border-t [scrollbar-width:none] md:order-none md:ms-auto md:w-auto md:justify-start md:gap-x-[clamp(1rem,2vw,1.9rem)] md:overflow-visible md:border-t-0"
				>
					{NAV_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="ms-warm-hover inline-flex h-11 items-center whitespace-nowrap font-medium text-[10px] text-foreground/70 uppercase tracking-[0.08em] hover:text-foreground md:text-[10.5px] md:tracking-[0.16em]"
						>
							<span className="ms-warm-line border-transparent border-b py-0.5">
								{t(link.labelKey)}
							</span>
						</a>
					))}
				</nav>
				<LocaleSwitcher />
				<a
					href={t("site.phoneHref")}
					className="ms-auto ms-serif inline-flex h-11 items-center whitespace-nowrap text-[1.02rem] md:ms-0 md:h-auto md:border-foreground/10 md:border-s md:ps-5"
				>
					{t("site.phoneDisplay")}
				</a>
			</div>
		</header>
	);
}
