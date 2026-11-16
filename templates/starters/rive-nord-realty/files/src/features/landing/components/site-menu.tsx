// The section menu of the phone header: a button that opens a side panel with the section links.
// SiteHeader renders it under 1024px. It uses the Sheet of the kit and the links of lib/nav-links.ts.
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
import { NAV_LINKS } from "../lib/nav-links";
import { DISPLAY, FIGURES, LABEL } from "../lib/type-styles";

/** A 44px ink-framed button. A tap on a link closes the panel, then the page goes to the section. */
export function SiteMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger asChild>
				<button
					type="button"
					aria-label={t("site.menuOpen")}
					className="inline-flex size-11 shrink-0 items-center justify-center border border-foreground lg:hidden"
				>
					<ListIcon className="size-5" />
				</button>
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes rn-page for the focus ring.
			    The last rule group makes the close button of the kit a 44px touch target. */}
			<SheetContent
				side="end"
				className="rn-page w-[min(88vw,360px)] gap-0 border-foreground border-s bg-background tracking-normal [&>button:last-child]:end-2 [&>button:last-child]:top-2 [&>button:last-child]:flex [&>button:last-child]:size-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center [&>button:last-child]:opacity-100"
			>
				<SheetHeader className="border-foreground border-b px-5 py-4">
					<SheetTitle className={cn(DISPLAY, "text-[1.6rem] leading-none")}>
						{t("site.brand")}
					</SheetTitle>
					<SheetDescription className={cn(LABEL, "text-[10px] opacity-65")}>
						{t("site.brandLine")}
					</SheetDescription>
				</SheetHeader>
				<nav aria-label={t("site.navLabel")} className="px-5">
					<ul>
						{NAV_LINKS.map((link, index) => (
							<li key={link.href} className="border-foreground/12 border-b">
								<SheetClose asChild>
									<a
										href={link.href}
										className={cn(
											DISPLAY,
											"flex min-h-15 items-baseline gap-3 py-3.5 text-[2.1rem] leading-none hover:text-primary",
										)}
									>
										<span className={cn(LABEL, FIGURES, "text-primary")}>
											{String(index + 1).padStart(2, "0")}
										</span>
										{t(link.labelKey)}
									</a>
								</SheetClose>
							</li>
						))}
					</ul>
				</nav>
				<SheetFooter className="gap-3 px-5 pb-6">
					<p className={cn(LABEL, "text-[10px] opacity-70")}>
						{t("site.menuHours")}
					</p>
					<a
						href={t("site.phoneHref")}
						className={cn(
							DISPLAY,
							FIGURES,
							"flex min-h-13 items-center justify-center bg-primary px-4 text-[1.35rem] text-primary-foreground leading-none tracking-[0.06em]",
						)}
					>
						{t("site.phoneDisplay")}
					</a>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
