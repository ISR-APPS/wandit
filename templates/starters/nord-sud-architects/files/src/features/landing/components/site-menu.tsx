// The phone menu: a header button that opens a side panel with the section links, the telephone, and the action.
// SiteHeader renders it. It shows below 1024px, where the header has no room for the links.
// The panel is the kit Sheet. A click on a link closes it, then the browser goes to the section.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/shared/ui/sheet";
import { CONTACT_HREF, SECTION_LINKS } from "../lib/content";
import { BUTTON_GHOST, BUTTON_PRIMARY, LABEL } from "../lib/styles";
import { Wordmark } from "./wordmark";

/** A square button of 44px with two ink bars. The panel lists the sections with their folio tabs. */
export function SiteMenu() {
	const { t } = useT();
	const [isOpen, setIsOpen] = useState(false);
	const close = () => setIsOpen(false);
	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger
				aria-label={t("site.menuOpen")}
				className="inline-flex size-11 shrink-0 flex-col items-center justify-center gap-1.5 border-[1.5px] border-foreground transition-colors duration-[180ms] ease-linear hover:bg-foreground/5 lg:hidden"
			>
				<span aria-hidden="true" className="h-[1.5px] w-4.5 bg-foreground" />
				<span aria-hidden="true" className="h-[1.5px] w-4.5 bg-foreground" />
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes the ns-scope class for the page variables.
			    The [&>button] classes give the close button of the kit a touch area of 44px. */}
			<SheetContent
				side="end"
				className="ns-scope ns-paper gap-0 border-foreground border-s-[1.5px] [&>button]:end-3 [&>button]:top-2.5 [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
			>
				<SheetHeader className="border-foreground border-b-[1.5px] px-6 py-5">
					<SheetTitle className="font-normal text-foreground text-xl">
						<Wordmark />
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuDescription")}
					</SheetDescription>
				</SheetHeader>
				<nav aria-label={t("site.navLabel")} className="flex flex-col px-6">
					{SECTION_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							onClick={close}
							className="flex min-h-14 items-center gap-4 border-foreground/20 border-b py-3 transition-colors duration-[180ms] ease-linear hover:bg-foreground/5"
						>
							<span
								className={`${LABEL} w-14 shrink-0 text-[0.625rem] text-foreground/60`}
							>
								{t(link.folio)}
							</span>
							<span className="ns-title text-[1.4rem] leading-tight">
								{t(link.label)}
							</span>
						</a>
					))}
				</nav>
				<div className="mt-auto grid gap-3 p-6">
					<a href={t("site.phoneHref")} className={BUTTON_GHOST}>
						{t("site.phoneDisplay")}
					</a>
					<a href={CONTACT_HREF} onClick={close} className={BUTTON_PRIMARY}>
						{t("nav.cta")}
					</a>
				</div>
			</SheetContent>
		</Sheet>
	);
}
