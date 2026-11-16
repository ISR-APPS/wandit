// The phone menu: a button of the header that opens a side panel with the section links.
// SiteHeader renders it. It shows below 1080px, where the header has no room for the links.
// The panel is the kit Sheet. A click on a link closes it, then the browser goes to the section.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/shared/ui/sheet";
import { BOOKING_HREF, NAV_LINKS } from "../lib/content";
import { BUTTON_FILLED, BUTTON_GHOST, LABEL } from "../lib/type-styles";

/** A square button of 44px with a two-line mark. The panel lists the links, the telephone, and the booking action. */
export function MobileMenu() {
	const { t } = useT();
	const [isOpen, setIsOpen] = useState(false);
	const close = () => setIsOpen(false);
	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger
				aria-label={t("site.menuOpen")}
				className="inline-flex size-11 shrink-0 flex-col items-center justify-center gap-1.5 rounded-(--sp-chamfer) border border-border transition-colors duration-200 hover:border-primary min-[67.5rem]:hidden"
			>
				<span aria-hidden="true" className="h-px w-4.5 bg-foreground" />
				<span aria-hidden="true" className="h-px w-4.5 bg-foreground" />
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes the sp-scope class for the page measures.
			    The [&>button] classes give the close button of the kit a touch area of 44px. */}
			<SheetContent
				side="end"
				className="sp-scope gap-0 tracking-normal [&>button]:end-2.5 [&>button]:top-2.5 [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
			>
				<SheetHeader className="border-border border-b px-6 py-5">
					<SheetTitle className="flex items-baseline gap-2.5 font-display font-semibold text-[1.2rem] tracking-[-0.02em]">
						{t("site.brandName")}
						<span
							className={cn(LABEL, "text-muted-foreground tracking-[0.14em]")}
						>
							{t("site.brandDescriptor")}
						</span>
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuDescription")}
					</SheetDescription>
				</SheetHeader>
				<nav aria-label={t("site.navLabel")} className="flex flex-col px-6">
					{NAV_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							onClick={close}
							className="flex min-h-14 items-center border-border border-b font-display text-[1.25rem] tracking-[-0.012em] transition-colors duration-200 hover:text-(--sp-teal-deep)"
						>
							{t(link.label)}
						</a>
					))}
				</nav>
				<div className="mt-auto grid gap-3 p-6">
					<a
						href={t("site.phoneHref")}
						className={cn(BUTTON_GHOST, "tabular-nums")}
					>
						{t("site.phoneDisplay")}
					</a>
					<a href={BOOKING_HREF} onClick={close} className={BUTTON_FILLED}>
						{t("site.book")}
					</a>
				</div>
			</SheetContent>
		</Sheet>
	);
}
