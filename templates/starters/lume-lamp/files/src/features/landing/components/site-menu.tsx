// The section menu of a phone: a "Menu" button in the header that opens a full-screen panel.
// SiteHeader renders it below 860px, where the four links do not fit beside the wordmark and the pill.
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
import { ATELIER_EMAIL, ATELIER_MAILTO } from "../lib/offer";
import { MICRO, WRAP } from "../lib/type-styles";
import { PillArrow } from "./pill-arrow";
import { Wordmark } from "./wordmark";

const MENU_BUTTON =
	"inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center px-2 font-medium text-[0.72rem] uppercase tracking-[0.16em]";

/** The phone menu. Its rows are ledger rows: a brass N° numeral, then the name of the section. */
export function SiteMenu() {
	const { t } = useT();
	const [isOpen, setIsOpen] = useState(false);
	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger className={`${MENU_BUTTON} -me-2 min-[860px]:hidden`}>
				{t("site.menu")}
			</SheetTrigger>
			{/* The kit close button is a 16px icon. This panel hides it and gives a 44px text button.
			    lume-page brings the page variables into the portal. */}
			<SheetContent
				side="top"
				className="lume-page h-svh gap-0 overflow-y-auto border-0 bg-background text-foreground [&>button]:hidden"
			>
				<div
					className={`${WRAP} flex flex-none items-center justify-between border-foreground/16 border-b py-3.5`}
				>
					<SheetTitle className="font-normal">
						<Wordmark />
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuTitle")}
					</SheetDescription>
					<SheetClose className={`${MENU_BUTTON} -me-2`}>
						{t("site.menuClose")}
					</SheetClose>
				</div>
				<nav aria-label={t("site.navLabel")} className={`${WRAP} pt-8`}>
					<ul className="border-foreground/16 border-t">
						{NAV_LINKS.map((link, index) => (
							<li key={link.href}>
								<a
									href={link.href}
									onClick={() => setIsOpen(false)}
									className="grid min-h-[4.5rem] grid-cols-[4.5rem_minmax(0,1fr)] items-baseline border-foreground/16 border-b py-5"
								>
									<span className="font-display font-medium text-(--lume-brass-deep) text-[0.95rem] tracking-[0.1em]">
										{`${t("site.numberSign")} ${String(index + 1).padStart(2, "0")}`}
									</span>
									<span className="font-display font-medium text-[1.9rem] leading-[1.05] tracking-[-0.01em]">
										{t(link.labelKey)}
									</span>
								</a>
							</li>
						))}
					</ul>
					<SheetClose asChild>
						<a href="#reserve" className="lume-btn mt-8">
							{t("site.reserve")}
							<PillArrow />
						</a>
					</SheetClose>
				</nav>
				<div className={`${WRAP} mt-auto pt-10 pb-8`}>
					<p className={MICRO}>{t("site.menuNote")}</p>
					<a href={ATELIER_MAILTO} className="lume-quiet mt-1 text-[0.95rem]">
						<span>{ATELIER_EMAIL}</span>
					</a>
				</div>
			</SheetContent>
		</Sheet>
	);
}
