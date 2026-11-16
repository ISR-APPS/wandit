// The section menu of the phone header: a button that opens a side panel with the section links.
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
import {
	BUTTON,
	BUTTON_HOT,
	DISPLAY_TEXT,
	LABEL_TEXT,
} from "../lib/type-styles";

/** A 44px ink button. A tap on a link closes the panel, then the page goes to the section. */
export function SiteMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger asChild>
				<button
					type="button"
					aria-label={t("site.menuOpen")}
					className="inline-flex size-11 shrink-0 items-center justify-center bg-foreground text-background lg:hidden"
				>
					<ListIcon className="size-5" />
				</button>
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes sc-page for the mustard and the focus ring.
			    The last rule group makes the close button of the kit a 44px touch target. */}
			<SheetContent
				side="end"
				className="sc-page w-[min(88vw,360px)] gap-0 border-foreground border-s-2 bg-background tracking-normal [&>button:last-child]:end-2 [&>button:last-child]:top-2 [&>button:last-child]:flex [&>button:last-child]:size-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center [&>button:last-child]:opacity-100"
			>
				<SheetHeader className="border-foreground border-b-2 px-5 py-3.5">
					<SheetTitle
						className={cn(DISPLAY_TEXT, "text-[1.75rem] leading-none")}
					>
						{t("site.brand")}
						<span className="text-primary">!</span>
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuDescription")}
					</SheetDescription>
				</SheetHeader>
				<nav aria-label={t("site.navLabel")} className="px-5">
					<ul>
						{NAV_LINKS.map((link, index) => (
							<li key={link.href} className="border-foreground/18 border-b">
								<SheetClose asChild>
									<a
										href={link.href}
										className={cn(
											DISPLAY_TEXT,
											"flex min-h-15 items-baseline gap-3 py-3.5 text-[2rem] leading-none hover:text-primary focus-visible:text-primary",
										)}
									>
										<span className="text-[1.1rem] text-primary">
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
					<p
						className={cn(
							LABEL_TEXT,
							"self-start bg-(--sc-mustard) px-2.75 py-1.5 tracking-[0.11em]",
						)}
					>
						{t("site.menuHours")}
					</p>
					<a
						href={t("site.phoneHref")}
						className={cn(BUTTON, BUTTON_HOT, "justify-center")}
					>
						{t("site.orderVerb")} · {t("site.phoneDisplay")}
					</a>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
