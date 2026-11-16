// The section menu of the phone header: a button that opens a cream panel with the section links.
// SiteHeader renders it under 1024px. It uses the Sheet of the kit and the links of lib/content.ts.
import { ListIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/shared/ui/sheet";
import { NAV_LINKS } from "../lib/content";
import { BUTTON, LABEL, LINK } from "../lib/type-styles";

/** A 44px ink button. A tap on a link closes the panel, then the page goes to the section. */
export function SiteMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger asChild>
				<button
					type="button"
					aria-label={t("site.menuOpen")}
					className="sf-btn inline-flex size-11 shrink-0 items-center justify-center lg:hidden"
				>
					<ListIcon className="size-5" />
				</button>
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes sf-page and sf-cream for the inks.
			    The last rule group makes the close button of the kit a 44px touch target. */}
			<SheetContent
				side="end"
				className="sf-page sf-cream w-[min(88vw,380px)] gap-0 border-0 font-sans tracking-normal [&>button:last-child]:end-3 [&>button:last-child]:top-3 [&>button:last-child]:flex [&>button:last-child]:size-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center [&>button:last-child]:rounded-none [&>button:last-child]:opacity-100"
			>
				<SheetHeader className="sf-cobalt gap-1 px-5 pt-5 pb-4">
					<SheetTitle className="font-display text-[2rem] text-inherit uppercase leading-none tracking-[0.02em]">
						{t("site.brand")}
					</SheetTitle>
					<SheetDescription className={cn(LABEL, "text-inherit")}>
						{t("site.menuTitle")}
					</SheetDescription>
				</SheetHeader>
				<nav aria-label={t("site.navLabel")} className="px-5 pt-2">
					<ul>
						{NAV_LINKS.map((link, index) => (
							<li key={link.href} className="border-current border-b-2">
								<SheetClose asChild>
									<a
										href={link.href}
										className="flex min-h-15 items-baseline gap-3 py-3 font-display text-[2.1rem] uppercase leading-none tracking-[0.01em] transition-colors duration-100 hover:text-(--sf-vermilion) focus-visible:text-(--sf-vermilion)"
									>
										<span className="font-bold font-sans text-[0.8rem] tabular-nums tracking-[0.06em]">
											{String(index + 1).padStart(2, "0")}
										</span>
										{t(link.labelKey)}
									</a>
								</SheetClose>
							</li>
						))}
					</ul>
				</nav>
				<SheetFooter className="items-start gap-4 px-5 pb-7">
					<a
						href={t("site.phoneHref")}
						className={cn(LINK, "text-base tabular-nums")}
					>
						{t("site.phoneDisplay")}
					</a>
					<SheetClose asChild>
						<a href="#book" className={cn(BUTTON, "w-full")}>
							{t("site.bookCta")}
						</a>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
