// The header of the home page: the wordmark, the section links in tracked capitals, and the telephone on a gold rule.
// LandingPage renders it. It is static, like the head of an invitation, with an ink hairline under it.
// Below 1024px the links move into the panel of SiteMenu.
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { NAV_LINKS } from "../lib/nav-links";
import { WRAP } from "../lib/type-styles";
import { SiteMenu } from "./site-menu";

/** The header bar. The links are anchors of the same page, so they work with no script. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="border-(--voeu-hair) border-b">
			<div
				className={`${WRAP} flex min-h-[72px] items-center justify-between gap-5 py-3`}
			>
				<a
					href="#top"
					className="inline-flex min-h-11 items-center font-display text-[clamp(1.35rem,2.1vw,1.7rem)] leading-none tracking-[0.02em]"
				>
					{t("site.brand")}
				</a>
				<div className="flex items-center gap-[clamp(16px,2.3vw,32px)]">
					<nav
						aria-label={t("site.navLabel")}
						className="hidden items-center gap-[clamp(16px,2.3vw,32px)] lg:flex"
					>
						{NAV_LINKS.map((link) => (
							<a
								key={link.href}
								href={link.href}
								className="voeu-swap whitespace-nowrap border-transparent border-b pb-[3px] font-bold text-[11.5px] text-foreground/74 uppercase leading-none tracking-[0.18em] hover:border-(--voeu-gold) hover:text-foreground focus-visible:border-(--voeu-gold) focus-visible:text-foreground"
							>
								{t(link.labelKey)}
							</a>
						))}
					</nav>
					<LocaleSwitcher />
					{/* A screen under 360px has no room for the number beside the wordmark. The menu panel shows it. */}
					<a
						href={t("site.phoneHref")}
						className="group inline-flex min-h-11 items-center whitespace-nowrap font-bold text-[11.5px] uppercase leading-none tracking-[0.14em] max-[359px]:hidden max-[399px]:tracking-[0.08em]"
					>
						<span className="voeu-swap border-(--voeu-gold-line) border-b pb-[3px] group-hover:border-primary group-focus-visible:border-primary">
							{t("site.phoneDisplay")}
						</span>
					</a>
					<SiteMenu />
				</div>
			</div>
		</header>
	);
}
