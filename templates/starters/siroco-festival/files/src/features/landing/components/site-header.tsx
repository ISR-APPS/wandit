// The header of the poster page: the wordmark, the section links, the box office telephone, and the book button.
// LandingPage renders it over the hero sheet. It is not fixed and not blurred, as the world asks.
// Under 1024px the section links move into the panel of SiteMenu.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { NAV_LINKS } from "../lib/content";
import { BUTTON, GUTTER, LINK } from "../lib/type-styles";
import { SiteMenu } from "./site-menu";

/** The first row of the cream hero, in its ink. The book button and the menu button are 44px tall at least. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header
			className={cn(
				GUTTER,
				"absolute inset-x-0 top-0 z-20 flex items-center gap-4 py-4 lg:gap-7 lg:py-5",
			)}
		>
			<a
				href="#top"
				className="inline-flex min-h-11 items-center font-display text-[1.35rem] uppercase leading-none tracking-[0.02em]"
			>
				{t("site.brand")}
			</a>
			<nav
				aria-label={t("site.navLabel")}
				className="ms-auto hidden items-center gap-6 lg:flex"
			>
				{/* The last link is "Book". The book button of the header shows it already. */}
				{NAV_LINKS.slice(0, -1).map((link) => (
					<a
						key={link.href}
						href={link.href}
						className={cn(LINK, "whitespace-nowrap text-[0.92rem]")}
					>
						{t(link.labelKey)}
					</a>
				))}
			</nav>
			<a
				href={t("site.phoneHref")}
				className={cn(
					LINK,
					"hidden whitespace-nowrap text-[0.92rem] tabular-nums xl:inline",
				)}
			>
				{t("site.phoneDisplay")}
			</a>
			<a
				href="#book"
				className={cn(
					BUTTON,
					"ms-auto min-h-11 px-5 py-2.5 text-[0.8rem] lg:ms-0",
				)}
			>
				<span className="sm:hidden">{t("site.bookShort")}</span>
				<span className="hidden sm:inline">{t("site.bookCta")}</span>
			</a>
			<SiteMenu />
		</header>
	);
}
