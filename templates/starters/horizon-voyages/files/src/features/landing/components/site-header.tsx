// The header of the home page: a paper bar with the wordmark, the section links, and the telephone chip.
// LandingPage renders it. It is not fixed: it scrolls away with the page, as the HORIZON world asks.
// Below 1024px the links move into the panel of SiteMenu.
import { useT } from "~/shared/i18n";
import { NAV_LINKS } from "../lib/nav-links";
import { SiteMenu } from "./site-menu";
import { Wordmark } from "./wordmark";

/** A bar with one hairline under it. No blur and no shadow. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="relative z-10 border-(--hz-hair) border-b bg-background">
			<div className="mx-auto flex min-h-[72px] max-w-[1240px] items-center gap-6 px-(--hz-gutter)">
				<a
					href="#top"
					aria-label={t("site.homeLabel")}
					className="inline-flex min-h-11 items-center"
				>
					<Wordmark className="text-[clamp(1.15rem,1.6vw,1.32rem)]" />
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="ms-auto hidden items-center gap-[clamp(1.1rem,1.9vw,1.65rem)] lg:flex"
				>
					{NAV_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="inline-flex min-h-11 items-center whitespace-nowrap font-semibold text-(--hz-ink-soft) text-[11px] uppercase leading-none tracking-[0.15em] hover:text-foreground focus-visible:text-foreground"
						>
							<span className="hz-underline py-1.5">{t(link.labelKey)}</span>
						</a>
					))}
				</nav>
				<div className="ms-auto flex items-center gap-3 lg:ms-0">
					{/* A phone under 420px has no room for the chip beside the wordmark. The menu panel shows the number. */}
					<a
						href={t("site.phoneHref")}
						className="hidden min-h-11 items-center gap-2 whitespace-nowrap border border-(--hz-hair) px-3 font-semibold text-[11px] leading-none tracking-[0.13em] transition-colors duration-200 hover:border-(--hz-sun) min-[420px]:inline-flex"
					>
						<span aria-hidden="true" className="size-1.5 bg-(--hz-sun)" />
						{t("site.phoneDisplay")}
					</a>
					<SiteMenu />
				</div>
			</div>
		</header>
	);
}
