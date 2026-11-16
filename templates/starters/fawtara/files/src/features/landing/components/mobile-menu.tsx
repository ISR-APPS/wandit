// The section menu of a phone: a round button that opens a side sheet with the four section links.
// SiteHeader renders it under 768px. The sheet is the kit Sheet, so it traps the focus and closes on Escape.
// A click on a link closes the sheet, then the browser jumps to the section.
import { ListIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/shared/ui/sheet";
import { SECTION_LINKS } from "../lib/sections";
import { PillLink } from "./pill-link";

/** The button is 44px wide. The sheet takes the class fw-page, so the variables of landing.css exist in it. */
export function MobileMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger
				aria-label={t("site.menuOpen")}
				className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-foreground/10 text-foreground text-xl md:hidden"
			>
				<ListIcon />
			</SheetTrigger>
			<SheetContent
				side="end"
				className="fw-page gap-0 bg-card tracking-normal"
			>
				<SheetHeader className="border-foreground/8 border-b px-6 py-5">
					<SheetTitle className="font-display font-extrabold text-lg">
						{t("site.menuTitle")}
					</SheetTitle>
					<SheetDescription>{t("site.menuDescription")}</SheetDescription>
				</SheetHeader>
				<nav aria-label={t("site.navLabel")} className="grid px-6 py-3">
					{SECTION_LINKS.map((link) => (
						<SheetClose key={link.href} asChild>
							<a
								href={link.href}
								className="flex min-h-14 items-center border-foreground/8 border-b font-bold font-display text-[1.15rem] text-foreground"
							>
								{t(link.labelKey)}
							</a>
						</SheetClose>
					))}
				</nav>
				<div className="px-6 pt-4">
					<SheetClose asChild>
						<PillLink href="#contact" tone="primary" className="w-full">
							{t("site.headerCta")}
						</PillLink>
					</SheetClose>
				</div>
			</SheetContent>
		</Sheet>
	);
}
