// The header of the Braise page: a sticky bar on the ground with the wordmark, three section links, and "Book".
// LandingPage renders it. The links are anchors of the same page, so they work with no script.
// Under 860px the links move into the panel of SiteMenu.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { NAV_LINKS } from "../lib/content";
import { BUTTON, BUTTON_EMBER } from "../lib/type-styles";
import { EmberDot } from "./ember-dot";
import { SiteMenu } from "./site-menu";

/** Solid ground and one hairline, no blur: the world header. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="sticky top-0 z-40 border-(--br-hair) border-b bg-background">
			<div className="br-wrap flex min-h-[70px] items-center justify-between gap-5 py-3">
				<a
					href="#top"
					aria-label={t("site.homeLabel")}
					className="flex min-h-11 items-center gap-3 font-display font-extrabold text-[clamp(17px,1.5vw,21px)] uppercase tracking-[0.12em]"
				>
					<EmberDot />
					{t("site.brand")}
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="flex items-center gap-[clamp(16px,2vw,32px)]"
				>
					{NAV_LINKS.filter((link) => link.isInHeader).map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="br-link hidden whitespace-nowrap font-semibold text-[13px] text-foreground/72 tracking-[0.05em] hover:text-foreground focus-visible:text-foreground min-[860px]:inline"
						>
							{t(link.labelKey)}
						</a>
					))}
					<a
						href="#book"
						className={cn(BUTTON, BUTTON_EMBER, "px-4.5 text-[12.5px]")}
					>
						{t("site.navBook")}
					</a>
					<SiteMenu />
				</nav>
			</div>
		</header>
	);
}
