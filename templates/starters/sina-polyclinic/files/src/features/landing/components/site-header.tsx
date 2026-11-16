// The sticky header of the public page: the wordmark, the section links, the telephone, and the booking action.
// LandingPage renders it. Every link is an anchor of the same page, so it works with no script.
// Below 1080px the section links move to the phone menu of mobile-menu.tsx.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BOOKING_HREF, NAV_LINKS } from "../lib/content";
import { BUTTON_FILLED, LABEL, WRAP } from "../lib/type-styles";
import { MobileMenu } from "./mobile-menu";
import { PulseGlyph } from "./pulse-glyph";

/** A bar of 66px (60px on a phone) with a hairline under it. The telephone and the action never leave it. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="sticky top-0 z-40 border-border border-b bg-background/95 backdrop-blur-[6px]">
			<div
				className={cn(
					WRAP,
					"flex min-h-15 items-center gap-[clamp(10px,2vw,32px)] sm:min-h-16.5",
				)}
			>
				<a href="#top" className="me-auto flex min-h-11 items-baseline gap-2.5">
					<PulseGlyph className="h-3 w-6.5 shrink-0 self-center text-primary" />
					<span className="self-center font-display font-semibold text-[1.2rem] tracking-[-0.02em]">
						{t("site.brandName")}
					</span>
					<span
						className={cn(
							LABEL,
							"hidden self-center pt-0.5 text-muted-foreground tracking-[0.14em] min-[22.5rem]:inline",
						)}
					>
						{t("site.brandDescriptor")}
					</span>
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="hidden gap-[clamp(14px,1.8vw,28px)] min-[67.5rem]:flex"
				>
					{NAV_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="whitespace-nowrap border-transparent border-b py-1.5 text-[0.8125rem] text-muted-foreground tracking-[0.01em] transition-colors duration-200 hover:border-primary hover:text-(--sp-teal-deep)"
						>
							{t(link.label)}
						</a>
					))}
				</nav>
				<a
					href={t("site.phoneHref")}
					className="hidden min-h-11 items-center whitespace-nowrap text-[0.8125rem] tabular-nums transition-colors duration-200 hover:text-(--sp-teal-deep) sm:inline-flex"
				>
					{t("site.phoneDisplay")}
				</a>
				<a
					href={BOOKING_HREF}
					className={cn(BUTTON_FILLED, "px-3.5 text-[0.8125rem] sm:px-4")}
				>
					<span className="sm:hidden">{t("site.bookShort")}</span>
					<span className="hidden sm:inline">{t("site.book")}</span>
				</a>
				<MobileMenu />
			</div>
		</header>
	);
}
