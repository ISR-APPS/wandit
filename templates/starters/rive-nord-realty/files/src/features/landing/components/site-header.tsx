// The sticky header of the board: the wordmark, the section links, and the agency telephone.
// LandingPage renders it. The links are anchors of the same page, so they work with no script.
// Under 1024px the links move into the panel of SiteMenu. Under 640px the number becomes a phone icon button.
import { PhoneIcon } from "@phosphor-icons/react";
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { NAV_LINKS } from "../lib/nav-links";
import { DISPLAY, FIGURES, LABEL, WRAP } from "../lib/type-styles";
import { SiteMenu } from "./site-menu";

/** 62px bar with a hairline under it. landing.css keeps the same height in --rn-header. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header
			className={cn(
				WRAP,
				"sticky top-0 z-40 flex h-15.5 items-center justify-between gap-4 border-foreground/12 border-b bg-background",
			)}
		>
			<a
				href="#top"
				className="flex min-h-11 items-center gap-2.5 whitespace-nowrap"
			>
				<span
					className={cn(DISPLAY, "text-[clamp(20px,2vw,25px)] leading-none")}
				>
					{t("site.brand")}
				</span>
				<span className={cn(LABEL, "hidden text-[10px] opacity-65 sm:inline")}>
					{t("site.brandLine")}
				</span>
			</a>
			<nav
				aria-label={t("site.navLabel")}
				className="hidden items-center gap-[clamp(18px,2vw,28px)] lg:flex"
			>
				{NAV_LINKS.map((link) => (
					<a
						key={link.href}
						href={link.href}
						className={cn(
							LABEL,
							"whitespace-nowrap py-1.5 tracking-[0.16em] transition-colors hover:text-primary",
						)}
					>
						{t(link.labelKey)}
					</a>
				))}
			</nav>
			<div className="flex items-center gap-1.5">
				<LocaleSwitcher />
				<a
					href={t("site.phoneHref")}
					aria-label={t("site.phoneLabel")}
					className="group flex min-h-11 min-w-11 items-center justify-center gap-2.5 whitespace-nowrap"
				>
					<span
						aria-hidden="true"
						className="hidden size-2.25 bg-primary sm:inline-block"
					/>
					<PhoneIcon className="size-5 text-primary sm:hidden" />
					<span
						className={cn(
							DISPLAY,
							FIGURES,
							"hidden text-[clamp(17px,1.6vw,21px)] leading-none tracking-[0.04em] transition-colors group-hover:text-primary sm:inline",
						)}
					>
						{t("site.phoneDisplay")}
					</span>
				</a>
				<SiteMenu />
			</div>
		</header>
	);
}
