// The header of the home page: the lowercase wordmark, four section links in the middle, and the booking button.
// LandingPage renders it. It lies over the hero photo with no bar and no blur: the head veil lifts the image.
// Below 1024px the links move into the panel of SiteMenu.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { NAV_LINKS } from "../lib/nav-links";
import { PRIMARY_BUTTON, WRAP } from "../lib/styles";
import { SiteMenu } from "./site-menu";

/** The header. The links are anchors of the same page, so they work with no script. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="absolute inset-x-0 top-0 z-20 py-[clamp(1.1rem,2.2vh,1.9rem)]">
			<div
				className={cn(
					WRAP,
					"grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[clamp(0.75rem,3vw,2.6rem)] lg:grid-cols-[auto_minmax(0,1fr)_auto]",
				)}
			>
				<a
					href="#top"
					aria-label={t("site.brandHome")}
					className="flex min-h-11 min-w-0 items-center no-underline"
				>
					<span className="flex min-w-0 items-baseline gap-[0.62rem]">
						<span className="font-display font-normal text-[1.62rem] leading-none tracking-[0.01em]">
							{t("site.brand")}
						</span>
						<span className="truncate font-sans text-[0.68rem] text-primary tracking-[0.24em] max-[359px]:hidden">
							{t("site.descriptor")}
						</span>
					</span>
				</a>
				<nav aria-label={t("site.navLabel")} className="hidden lg:block">
					<ul className="m-0 flex list-none items-center justify-center gap-[clamp(1rem,2vw,2rem)] p-0">
						{NAV_LINKS.map((link) => (
							<li key={link.href}>
								<a
									href={link.href}
									className="group inline-flex min-h-11 items-center whitespace-nowrap font-sans text-(--onde-ink-72) text-[0.83rem] tracking-[0.06em] no-underline transition-colors duration-[350ms] ease-(--onde-tide) hover:text-foreground focus-visible:text-foreground"
								>
									<span className="border-transparent border-b pb-0.5 transition-colors duration-[350ms] ease-(--onde-tide) group-hover:border-(--onde-sage) group-focus-visible:border-(--onde-sage)">
										{t(link.labelKey)}
									</span>
								</a>
							</li>
						))}
					</ul>
				</nav>
				<div className="flex items-center gap-2.5">
					<a
						href="#book"
						className={cn(
							PRIMARY_BUTTON,
							"px-[1.1rem] py-[0.66rem] text-[0.82rem]",
						)}
					>
						{t("site.bookCta")}
					</a>
					<SiteMenu />
				</div>
			</div>
		</header>
	);
}
