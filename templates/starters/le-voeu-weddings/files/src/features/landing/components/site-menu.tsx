// The phone menu: a header button that opens a side panel with the section links.
// SiteHeader renders it. It shows below 1024px, where the header has no room for the links.
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
import { BUTTON, ROSE_FACT } from "../lib/type-styles";

/** A square button of 44px with two gold hairlines. The panel lists the sections, the telephone, and the reply card. */
export function SiteMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger
				aria-label={t("site.menuOpen")}
				className="voeu-swap inline-flex size-11 shrink-0 flex-col items-center justify-center gap-[7px] border border-(--voeu-gold-line) hover:border-primary lg:hidden"
			>
				<span aria-hidden="true" className="h-px w-[18px] bg-foreground" />
				<span aria-hidden="true" className="h-px w-[18px] bg-foreground" />
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes the voeu-scope class for the page variables.
			    The [&>button] classes give the close button of the kit a touch area of 44px. */}
			<SheetContent
				side="end"
				className="voeu-scope gap-0 overflow-y-auto font-sans tracking-normal [&>button]:end-3 [&>button]:top-3 [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
			>
				<SheetHeader className="border-(--voeu-hair) border-b px-6 py-5">
					<SheetTitle className="font-display font-normal text-[1.5rem] leading-none">
						{t("site.brand")}
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuDescription")}
					</SheetDescription>
				</SheetHeader>
				<nav aria-label={t("site.navLabel")} className="flex flex-col px-6">
					{NAV_LINKS.map((link) => (
						<SheetClose key={link.href} asChild>
							<a
								href={link.href}
								className="voeu-swap flex min-h-14 items-center border-(--voeu-hair) border-b py-3 font-display text-[1.45rem] leading-tight hover:text-(--voeu-rose-deep)"
							>
								{t(link.labelKey)}
							</a>
						</SheetClose>
					))}
				</nav>
				<div className="mt-auto grid gap-5 p-6">
					<a
						href={t("site.phoneHref")}
						className="inline-flex min-h-11 items-center justify-between gap-4 border-(--voeu-gold-line) border-b pb-2 font-display text-[1.2rem]"
					>
						<span className={ROSE_FACT}>{t("site.phoneLabel")}</span>
						{t("site.phoneDisplay")}
					</a>
					<SheetClose asChild>
						<a href="#reply" className={cn(BUTTON, "w-full")}>
							{t("hero.ctaDate")}
						</a>
					</SheetClose>
				</div>
			</SheetContent>
		</Sheet>
	);
}
