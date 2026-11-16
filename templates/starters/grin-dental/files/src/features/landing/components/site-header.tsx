// The floating header of the home page: a white pill sticker with the logo, the section links, and "Book a visit".
// LandingPage renders it. It stays fixed at the top; only the pill takes clicks, the air around it lets them through.
// Under 1024px the links move into the panel of SiteMenu. Under 560px the book button moves there too.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { NAV_LINKS } from "../lib/content";
import { BUTTON, DISPLAY, WRAP } from "../lib/styles";
import { BrandMark } from "./brand-mark";
import { SiteMenu } from "./site-menu";

/** The pill bar, about 64px high, 14px below the top of the screen. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="pointer-events-none fixed inset-x-0 top-0 z-40 py-3.5">
			<div
				className={cn(
					WRAP,
					"gd-outline gd-shadow-5 pointer-events-auto flex items-center gap-3 rounded-full bg-card py-2 ps-3 pe-2.5 sm:ps-4",
				)}
			>
				<a
					href="#top"
					aria-label={t("site.brandHome")}
					className={cn(
						DISPLAY,
						"flex min-h-11 items-center gap-2.5 whitespace-nowrap text-[clamp(1.02rem,1.6vw,1.15rem)]",
					)}
				>
					<BrandMark className="size-8.5" />
					<span>
						{t("site.brandFirst")}
						<span className="text-primary">
							{" "}
							{t("site.brandRest")}
						</span>
					</span>
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="ms-auto hidden lg:block"
				>
					<ul className="flex items-center gap-0.5">
						{NAV_LINKS.map((link) => (
							<li key={link.href}>
								<a
									href={link.href}
									className="inline-flex min-h-11 items-center rounded-full px-3 font-bold font-display text-[0.95rem] transition-[rotate,scale,background-color] duration-200 ease-(--gd-pop) hover:-rotate-2 hover:scale-105 hover:bg-(--gd-peach)"
								>
									{t(link.labelKey)}
								</a>
							</li>
						))}
					</ul>
				</nav>
				<a
					href="#book"
					className={cn(
						BUTTON,
						"ms-auto hidden whitespace-nowrap px-[1.25em] py-[0.65em] text-[0.92rem] lg:ms-1.5 min-[560px]:inline-flex",
					)}
				>
					{t("site.bookCta")}
				</a>
				<SiteMenu />
			</div>
		</header>
	);
}
