// The phone menu: a 44px button with three lines that opens a side panel with the section links,
// the telephone, and the reserve button. SiteHeader renders it. It shows below 1024px.
// The panel is the kit Sheet. Each link is a SheetClose: a click closes the panel, then the browser goes to the section.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/shared/ui/sheet";
import { NAV_LINKS } from "../lib/nav-links";
import { INK_BUTTON, LABEL } from "../lib/styles";
import { BrandMark } from "./brand-mark";

/** The menu button and its panel. The panel lists the sections in the display serif, numbered as on the page. */
export function SiteMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger
				aria-label={t("site.menuOpen")}
				className="inline-flex size-11 shrink-0 flex-col items-center justify-center gap-[5px] rounded-full border border-(--sp-line) transition-colors duration-500 hover:border-foreground lg:hidden"
			>
				<span aria-hidden="true" className="h-[1.6px] w-[18px] bg-foreground" />
				<span aria-hidden="true" className="h-[1.6px] w-[18px] bg-foreground" />
				<span aria-hidden="true" className="h-[1.6px] w-[18px] bg-foreground" />
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes the sp-scope class for the page colors.
			    The [&>button] classes give the close button of the kit a touch area of 44px. */}
			<SheetContent
				side="end"
				className="sp-scope gap-0 overflow-y-auto border-(--sp-line-soft) bg-background font-sans text-foreground [&>button]:end-3 [&>button]:top-3 [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full"
			>
				<SheetHeader className="border-(--sp-line-soft) border-b px-6 py-5">
					<SheetTitle className="flex items-center gap-[11px] font-display font-normal text-[1.32rem] leading-none">
						<BrandMark />
						{t("site.brand")}
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuDescription")}
					</SheetDescription>
				</SheetHeader>
				<nav
					aria-label={t("site.navLabel")}
					className="flex flex-col px-6 pt-2"
				>
					{NAV_LINKS.map((link, index) => (
						<SheetClose key={link.href} asChild>
							<a
								href={link.href}
								className="flex min-h-14 items-baseline gap-4 border-(--sp-line-soft) border-b py-3 font-display text-[1.5rem] leading-tight no-underline transition-colors duration-500 hover:text-primary"
							>
								<span className="font-bold font-sans text-(--sp-terra-ink) text-[0.7rem] tabular-nums tracking-[0.2em]">
									{String(index + 1).padStart(2, "0")}
								</span>
								{t(link.labelKey)}
							</a>
						</SheetClose>
					))}
				</nav>
				<div className="mt-auto grid gap-2 p-6">
					<p className={LABEL}>{t("site.menuCallLabel")}</p>
					<a
						href={t("begin.phoneHref")}
						className="inline-flex min-h-11 items-center font-display text-[1.35rem] tabular-nums no-underline"
					>
						{t("begin.phoneDisplay")}
					</a>
					<p className="text-(--sp-ink-78) text-sm">{t("site.menuHours")}</p>
					<SheetClose asChild>
						<a href="#begin" className={cn(INK_BUTTON, "mt-3 w-full")}>
							{t("site.reserveCta")}
						</a>
					</SheetClose>
				</div>
			</SheetContent>
		</Sheet>
	);
}
