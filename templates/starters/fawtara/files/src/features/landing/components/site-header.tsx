// The header of the public page: a white bar with the wordmark, the section links, and the contact button.
// LandingPage renders it. The links are anchors of the same page, so they work with no script.
// Under 768px the links move into MobileMenu.
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { WRAP } from "../lib/class-names";
import { SECTION_LINKS } from "../lib/sections";
import { BrandMark } from "./brand-mark";
import { MobileMenu } from "./mobile-menu";
import { PillLink } from "./pill-link";

/** Sticky top bar, 72px high, with a hairline at its foot. It has no blur and no shadow. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="sticky top-0 z-40 border-foreground/8 border-b bg-card">
			<div className={`${WRAP} flex h-18 items-center gap-3 md:gap-7`}>
				<BrandMark />
				<nav
					aria-label={t("site.navLabel")}
					className="ms-auto hidden items-center gap-7 md:flex"
				>
					{SECTION_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="inline-flex h-11 items-center whitespace-nowrap font-medium text-[0.95rem] text-muted-foreground transition-colors hover:text-primary"
						>
							{t(link.labelKey)}
						</a>
					))}
				</nav>
				<LocaleSwitcher />
				<PillLink
					href="#contact"
					tone="primary"
					className="ms-auto min-h-11 px-5 text-[0.9rem] md:ms-0 md:min-h-12 md:px-7 md:text-[0.96rem]"
				>
					{t("site.headerCta")}
				</PillLink>
				<MobileMenu />
			</div>
		</header>
	);
}
