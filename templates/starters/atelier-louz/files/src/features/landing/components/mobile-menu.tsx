// The phone and tablet menu of the home page: an arch button that opens a side sheet with the section links.
// SiteHeader renders it below the lg width. It uses the Sheet of the kit and SECTION_LINKS of the header.
import { ListIcon, XIcon } from "@phosphor-icons/react";
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
import type { MaterialId } from "../lib/materials";
import { SECTION_LINKS } from "../lib/sections";

/**
 * The menu button and its sheet. A link click closes the sheet, then the page scrolls to the section.
 * The sheet renders outside the page root, so it repeats `material` to keep the page tint.
 */
export function MobileMenu({ material }: { material: MaterialId }) {
	const { t } = useT();
	const [isOpen, setIsOpen] = useState(false);
	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger
				aria-label={t("nav.openMenu")}
				className="louz-btn-ghost inline-flex size-11 items-center justify-center text-xl lg:hidden"
			>
				<ListIcon />
			</SheetTrigger>
			{/* The kit close button is small. The last-child rule hides it, and a 44 px arch button replaces it. */}
			<SheetContent
				side="end"
				data-material={material}
				className="louz w-full gap-0 bg-background px-6 pt-5 pb-8 sm:max-w-sm [&>button:last-child]:hidden"
			>
				<div className="flex items-center justify-between">
					<SheetTitle className="font-display font-normal text-[1.35rem]">
						{t("nav.menuTitle")}
					</SheetTitle>
					<SheetClose
						aria-label={t("nav.closeMenu")}
						className="louz-btn-ghost inline-flex size-11 items-center justify-center text-xl"
					>
						<XIcon />
					</SheetClose>
				</div>
				<nav aria-label={t("nav.label")} className="mt-10">
					<ul className="flex flex-col">
						{SECTION_LINKS.map((link, index) => (
							<li key={link.href} className="border-(--louz-hair) border-b">
								<a
									href={link.href}
									onClick={() => setIsOpen(false)}
									className="flex min-h-16 items-baseline gap-4 py-3 font-display text-[1.9rem] leading-tight"
								>
									<span className="louz-tint-text font-bold font-sans text-sm tabular-nums">
										{String(index + 1).padStart(2, "0")}
									</span>
									{t(link.key)}
								</a>
							</li>
						))}
					</ul>
				</nav>
				<div className="mt-auto flex flex-col gap-3 pt-10">
					<a
						href={t("site.phoneHref")}
						className="louz-btn inline-flex min-h-12 items-center justify-center px-6 pt-[0.15em] font-bold"
					>
						{t("hero.callLabel")}
					</a>
					<SheetDescription className="text-center text-foreground/70 text-sm">
						{t("nav.menuNote")}
					</SheetDescription>
				</div>
			</SheetContent>
		</Sheet>
	);
}
