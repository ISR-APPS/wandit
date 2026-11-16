// The section menu of the phone header: a button that opens a side panel with every section link.
// SiteHeader renders it under 860px. It uses the Sheet of the kit and NAV_LINKS of lib/content.ts.
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
import { BUTTON, BUTTON_EMBER, FIGURE } from "../lib/type-styles";
import { Eyebrow } from "./eyebrow";

/** A 44px hairline button. A tap on a link closes the panel, then the page goes to the section. */
export function SiteMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger asChild>
				<button
					type="button"
					aria-label={t("site.menuOpen")}
					className="inline-flex size-11 shrink-0 items-center justify-center rounded-[calc(var(--radius)*0.34)] border border-foreground/22 text-foreground transition-colors hover:border-primary focus-visible:border-primary min-[860px]:hidden"
				>
					<ListIcon className="size-5" />
				</button>
			</SheetTrigger>
			{/* The last rule group makes the close button of the kit a 44px touch target. */}
			<SheetContent
				side="end"
				className="br-panel w-[min(88vw,360px)] gap-0 border-(--br-hair) bg-background [&>button:last-child]:end-2 [&>button:last-child]:top-3 [&>button:last-child]:flex [&>button:last-child]:size-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center [&>button:last-child]:opacity-100"
			>
				<SheetHeader className="border-(--br-hair) border-b px-6 py-5">
					<SheetTitle className="font-display font-extrabold text-xl uppercase tracking-[0.12em]">
						{t("site.brand")}
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuDescription")}
					</SheetDescription>
				</SheetHeader>
				<nav aria-label={t("site.navLabel")} className="px-6">
					<ul>
						{NAV_LINKS.map((link, index) => (
							<li key={link.href} className="border-(--br-hair) border-b">
								<SheetClose asChild>
									<a
										href={link.href}
										className="flex min-h-14 items-baseline gap-4 py-4 font-display font-semibold text-[1.65rem] leading-none tracking-[-0.02em] hover:text-(--br-ember-hot) focus-visible:text-(--br-ember-hot)"
									>
										<span className={cn(FIGURE, "text-primary text-sm")}>
											{String(index + 1).padStart(2, "0")}
										</span>
										{t(link.labelKey)}
									</a>
								</SheetClose>
							</li>
						))}
					</ul>
				</nav>
				<SheetFooter className="gap-4 px-6 pb-8">
					<Eyebrow>{t("site.menuHours")}</Eyebrow>
					<SheetClose asChild>
						<a href="#book" className={cn(BUTTON, BUTTON_EMBER)}>
							{t("hero.ctaBook")}
						</a>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
