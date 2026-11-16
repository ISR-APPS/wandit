// The section menu of a phone: a "Menu" button in the header that opens a full-screen panel.
// SiteHeader renders it below 900px, where the five links do not fit beside the wordmark and the basket.
// It uses the Sheet of the kit. A tap on a link closes the panel, then the browser jumps to the section.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetTitle,
	SheetTrigger,
} from "~/shared/ui/sheet";
import { NAV_LINKS } from "../lib/nav-links";
import { CONTACT_LINK, MONO, WRAP } from "../lib/type-styles";
import { Wordmark } from "./wordmark";

const MENU_BUTTON =
	"nour-mono inline-flex h-11 cursor-pointer items-center px-2.5 text-[10.5px] uppercase tracking-[0.12em]";

/** The phone menu. Its rows repeat the lines of the shelf: a mono number, then the name of the section. */
export function SiteMenu() {
	const { t } = useT();
	const [isOpen, setIsOpen] = useState(false);
	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger className={`${MENU_BUTTON} -me-2.5 min-[900px]:hidden`}>
				{t("site.menu")}
			</SheetTrigger>
			{/* The kit close button is a 16px icon. This panel hides it and gives a 44px text button. */}
			<SheetContent
				side="top"
				className="nour-page h-svh gap-0 overflow-y-auto border-0 tracking-normal [&>button]:hidden"
			>
				<div
					className={`${WRAP} flex h-16 flex-none items-center justify-between border-foreground/16 border-b`}
				>
					<SheetTitle className="font-normal">
						<Wordmark />
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuTitle")}
					</SheetDescription>
					<SheetClose className={`${MENU_BUTTON} -me-2.5`}>
						{t("site.menuClose")}
					</SheetClose>
				</div>
				<nav aria-label={t("site.navLabel")} className={`${WRAP} pt-8`}>
					<ul className="border-foreground border-t">
						{NAV_LINKS.map((link) => (
							<li key={link.href}>
								<a
									href={link.href}
									onClick={() => setIsOpen(false)}
									className="grid min-h-[68px] grid-cols-[44px_minmax(0,1fr)] items-baseline border-foreground/9 border-b py-5"
								>
									<span className={MONO}>{link.number}</span>
									<span className="font-display font-medium text-[26px] leading-[1.05] tracking-[-0.03em]">
										{t(link.labelKey)}
									</span>
								</a>
							</li>
						))}
					</ul>
				</nav>
				<div className={`${WRAP} mt-auto pt-10 pb-6`}>
					<p className={MONO}>{t("site.addressShort")}</p>
					<p className={MONO}>
						{t("site.hours1")}, {t("site.hours2")}
					</p>
					<div className="mt-3 flex flex-col items-start text-[15px]">
						<a href={t("site.phoneHref")} className={CONTACT_LINK}>
							{t("site.phone")}
						</a>
						<a href={t("site.emailHref")} className={CONTACT_LINK}>
							{t("site.email")}
						</a>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
