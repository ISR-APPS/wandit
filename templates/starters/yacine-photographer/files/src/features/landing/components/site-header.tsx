// The sticky header of the home page: the wordmark, the section links, and the phone plate.
// landing-page.tsx renders it. It reads NAV_LINKS from lib/content.ts and the scroll state from use-is-scrolled.ts.
// Below 820px the links move to a second row of the sticky header, so a phone keeps the section links.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useIsScrolled } from "../hooks/use-is-scrolled";
import { NAV_LINKS } from "../lib/content";
import { WRAP } from "../lib/styles";

const NAV_LINK =
	"yr-mono inline-flex min-h-11 items-center text-primary uppercase hover:text-foreground focus-visible:text-foreground";

/** A solid bar on the page ground, never translucent. Its hairline cuts in after 70px of scroll. */
export function SiteHeader() {
	const { t } = useT();
	const isScrolled = useIsScrolled();
	return (
		<header
			className={cn(
				"sticky top-0 z-50 border-b bg-background",
				isScrolled ? "border-foreground/15" : "border-transparent",
				"max-[819px]:border-foreground/15",
			)}
		>
			<div
				className={`${WRAP} flex min-h-[58px] items-center justify-between gap-3.5 sm:min-h-[66px]`}
			>
				<a
					href="#top"
					className="inline-flex min-h-11 items-center whitespace-nowrap"
				>
					<span className="flex items-baseline gap-3">
						<span className="font-display font-extrabold text-[1.06rem] uppercase tracking-[-0.03em]">
							{t("site.brand")}
						</span>
						<span className="yr-mono hidden text-[0.64rem] text-primary uppercase tracking-[0.15em] min-[1100px]:inline">
							{t("site.brandDescriptor")}
						</span>
					</span>
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="hidden gap-[clamp(14px,1.9vw,30px)] min-[820px]:flex"
				>
					{NAV_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className={`${NAV_LINK} text-[0.68rem] tracking-[0.15em]`}
						>
							{t(link.labelKey)}
						</a>
					))}
				</nav>
				{/* The link is 44px high for a thumb. The plate inside it stays a thin frame. */}
				<a
					href={t("site.phoneHref")}
					className="group inline-flex min-h-11 items-center whitespace-nowrap"
				>
					<span
						dir="ltr"
						className="yr-mono border border-foreground/30 px-3 py-[7px] text-[0.68rem] text-foreground tracking-[0.08em] group-hover:border-foreground group-hover:bg-foreground group-hover:text-background group-focus-visible:border-foreground group-focus-visible:bg-foreground group-focus-visible:text-background"
					>
						{t("site.phone")}
					</span>
				</a>
			</div>
			{/* The phone row, as the source page has it. A hairline under it separates the header from the page at all scroll positions. */}
			<nav
				aria-label={t("site.navLabelPhone")}
				className={`${WRAP} flex justify-between gap-2 min-[820px]:hidden`}
			>
				{NAV_LINKS.map((link) => (
					<a
						key={link.href}
						href={link.href}
						className={`${NAV_LINK} text-[0.66rem] tracking-[0.08em]`}
					>
						{t(link.labelKey)}
					</a>
				))}
			</nav>
		</header>
	);
}
