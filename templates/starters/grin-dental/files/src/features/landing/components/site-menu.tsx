// The section menu of the phone and tablet header: a sun button that opens a side panel with the section links.
// SiteHeader renders it under 1024px. It uses the Sheet of the kit, the links of lib/content.ts, and the book actions.
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
import { BUTTON, DISPLAY, TAG } from "../lib/styles";
import { BrandMark } from "./brand-mark";

/** A 44px sun button. A tap on a link closes the panel, then the page goes to the section. */
export function SiteMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger asChild>
				<button
					type="button"
					aria-label={t("site.menuOpen")}
					className="gd-outline-thin gd-shadow-3 active:translate-0.5 ms-auto inline-flex size-11 shrink-0 items-center justify-center rounded-[calc(var(--radius)*0.875)] bg-(--gd-sun) transition-[translate,box-shadow] lg:hidden min-[560px]:ms-0"
				>
					<ListIcon className="size-5.5" />
				</button>
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes gd-page for the sticker colors and the focus ring.
			    The last rule group makes the close button of the kit a 44px touch target. */}
			<SheetContent
				side="end"
				className="gd-page gd-dots w-[min(88vw,360px)] gap-0 border-foreground border-s-2 bg-background [&>button:last-child]:end-3 [&>button:last-child]:top-3 [&>button:last-child]:flex [&>button:last-child]:size-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center [&>button:last-child]:opacity-100"
			>
				<SheetHeader className="px-5 pt-5 pb-3">
					<SheetTitle
						className={cn(
							DISPLAY,
							"flex items-center gap-2.5 text-[1.6rem] leading-none",
						)}
					>
						<BrandMark className="size-9" />
						{t("site.menuTitle")}
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuDescription")}
					</SheetDescription>
				</SheetHeader>
				<nav aria-label={t("site.navLabel")} className="px-5 pt-2">
					<ul className="grid gap-2.5">
						{NAV_LINKS.map((link, index) => (
							<li key={link.href}>
								<SheetClose asChild>
									<a
										href={link.href}
										className={cn(
											DISPLAY,
											"gd-outline-thin gd-shadow-3 flex min-h-13 items-center justify-between rounded-full bg-card px-5 text-[1.3rem] leading-none transition-[rotate,background-color] duration-200 hover:bg-(--gd-peach) focus-visible:bg-(--gd-peach)",
											index % 2 === 0 ? "hover:-rotate-1" : "hover:rotate-1",
										)}
									>
										{t(link.labelKey)}
										<span
											aria-hidden="true"
											className="inline-block text-primary rtl:-scale-x-100"
										>
											→
										</span>
									</a>
								</SheetClose>
							</li>
						))}
					</ul>
				</nav>
				<SheetFooter className="mt-auto gap-3 px-5 pb-7">
					<p className={cn(TAG, "-rotate-2 self-start bg-(--gd-mint)")}>
						{t("site.menuHours")}
					</p>
					<SheetClose asChild>
						<a href="#book" className={cn(BUTTON, "w-full")}>
							{t("site.bookCta")}
						</a>
					</SheetClose>
					<a
						href={t("site.phoneHref")}
						className={cn(BUTTON, "gd-btn-white w-full")}
					>
						{t("site.phoneDisplay")}
					</a>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
