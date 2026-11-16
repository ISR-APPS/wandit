// The phone menu: a capsule button that opens a side panel with the section links, the telephone, and the booking.
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
import { PRIMARY_CAPSULE } from "../lib/type-styles";
import { CapsuleBadge } from "./capsule-badge";
import { PetalGlyph } from "./petal-glyph";

/** A round button of 44px with two cacao lines. The panel lists the sections, the telephone, and the booking. */
export function SiteMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger
				aria-label={t("site.menuOpen")}
				className="inline-flex size-11 shrink-0 flex-col items-center justify-center gap-[6px] rounded-full border border-foreground/20 bg-card/40 transition-colors duration-[350ms] hover:bg-(--lumia-blush)/60 lg:hidden"
			>
				<span aria-hidden="true" className="h-px w-[16px] bg-foreground" />
				<span aria-hidden="true" className="h-px w-[16px] bg-foreground" />
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes the lumia-scope class for the page colors.
			    The [&>button] classes give the close button of the kit a touch area of 44px. */}
			<SheetContent
				side="end"
				className="lumia-scope gap-0 overflow-y-auto bg-background font-sans text-foreground tracking-normal [&>button]:end-3 [&>button]:top-3 [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full"
			>
				<SheetHeader className="border-(--lumia-hair) border-b px-6 py-5">
					<SheetTitle className="font-display font-normal text-[1.5rem] leading-none">
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
					{NAV_LINKS.map((link) => (
						<SheetClose key={link.href} asChild>
							<a
								href={link.href}
								className="flex min-h-14 items-center gap-3 border-(--lumia-hair) border-b py-3 font-display text-[1.6rem] leading-tight no-underline transition-colors duration-[350ms] hover:text-(--lumia-bronze-deep)"
							>
								<PetalGlyph className="size-[14px] shrink-0 text-primary" />
								{t(link.labelKey)}
							</a>
						</SheetClose>
					))}
				</nav>
				<div className="mt-auto grid gap-4 p-6">
					<CapsuleBadge>{t("site.phoneLabel")}</CapsuleBadge>
					<a
						href={t("site.phoneHref")}
						className="inline-flex min-h-11 items-center font-semibold text-[1.15rem] tracking-[0.02em] no-underline"
					>
						{t("site.phoneDisplay")}
					</a>
					<SheetClose asChild>
						<a href="#contact" className={cn(PRIMARY_CAPSULE, "w-full")}>
							{t("hero.cta")}
						</a>
					</SheetClose>
				</div>
			</SheetContent>
		</Sheet>
	);
}
