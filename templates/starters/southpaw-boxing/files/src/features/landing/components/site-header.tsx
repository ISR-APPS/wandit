// The sticky header of the landing page: the brand, the anchor links, the free-round action, and the mobile menu.
// landing-page.tsx renders it. The gold bar under it reads use-scroll-progress.ts.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { useScrollProgress } from "../hooks/use-scroll-progress";
import { NAV_LINKS } from "../lib/content";

/** The header stays at the top of the page. Its mobile menu is a native details element, so it opens with no script. */
export function SiteHeader() {
	const { t } = useT();
	const progress = useScrollProgress();
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	return (
		<header className="sp-head sticky top-0 z-50">
			<nav
				aria-label={t("site.navLabel")}
				className="sp-gutter mx-auto flex max-w-7xl items-center gap-3 py-3 xl:gap-6"
			>
				<a href="#top" className="flex shrink-0 items-center gap-2.5 sm:gap-3">
					<span className="font-display font-extrabold text-2xl uppercase leading-none tracking-[0.03em] sm:text-[1.75rem]">
						{t("site.brandName")}{" "}
						<span className="text-primary">{t("site.brandInitials")}</span>
					</span>
					<span className="sp-line whitespace-nowrap border px-1.5 py-1 font-bold text-[0.56rem] text-muted-foreground uppercase tracking-[0.2em] sm:px-2 sm:text-[0.6rem] sm:tracking-[0.3em]">
						{t("site.brandEst")}
					</span>
				</a>

				{/* The brand, the five links, and the action need about 1200px. Below xl the page shows the menu button. */}
				<ul className="ms-auto hidden gap-7 xl:flex">
					{NAV_LINKS.map((link) => (
						<li key={link.href}>
							<a
								href={link.href}
								className="sp-nav-link block whitespace-nowrap py-1.5 font-bold text-[0.78rem] text-muted-foreground uppercase tracking-[0.18em] hover:text-foreground focus-visible:text-foreground"
							>
								{t(link.label)}
							</a>
						</li>
					))}
				</ul>
				<a
					href="#book"
					className="sp-btn sp-btn-cream ms-2 hidden shrink-0 px-4 pt-2 pb-1.5 font-display font-extrabold text-lg uppercase leading-tight tracking-[0.06em] xl:inline-block"
				>
					{t("site.navCta")}
				</a>

				<details
					className="sp-menu relative ms-auto xl:hidden"
					open={isMenuOpen}
					onToggle={(event) => setIsMenuOpen(event.currentTarget.open)}
				>
					<summary className="sp-line-strong cursor-pointer border px-3 pt-2 pb-1.5 font-display font-extrabold text-lg uppercase leading-tight tracking-[0.12em] sm:px-4">
						{t("site.menu")}
					</summary>
					<div className="sp-menu-panel absolute end-0 top-[calc(100%+0.6rem)] min-w-60 py-2">
						{[
							...NAV_LINKS,
							{ href: "#book", label: "site.navCta" } as const,
						].map((link) => (
							<a
								key={link.href}
								href={link.href}
								onClick={() => setIsMenuOpen(false)}
								className="block px-5 py-3 font-bold text-[0.8rem] uppercase tracking-[0.18em]"
							>
								{t(link.label)}
							</a>
						))}
					</div>
				</details>
			</nav>
			<div className="relative" aria-hidden="true">
				<div className="sp-head-strip" />
				<div
					className="sp-progress absolute inset-0"
					style={{ transform: `scaleX(${progress})` }}
				/>
			</div>
		</header>
	);
}
