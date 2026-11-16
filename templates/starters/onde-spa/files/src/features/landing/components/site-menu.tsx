// The phone menu: a 44px button that opens a side panel with the section links, the telephone, and the booking.
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
import { LABEL, PRIMARY_BUTTON } from "../lib/styles";
import { PebbleGlyph } from "./pebble-glyph";
import { SteamVeil } from "./steam-veil";

/** Two hairlines on a 44px ground square. The panel lists the sections, the telephone, and the booking. */
export function SiteMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger
				aria-label={t("site.menuOpen")}
				className="inline-flex size-11 shrink-0 flex-col items-center justify-center gap-[6px] rounded-md border border-(--onde-hair-strong) bg-background/70 transition-colors duration-[400ms] ease-(--onde-tide) hover:border-(--onde-sage) lg:hidden"
			>
				<span aria-hidden="true" className="h-px w-4 bg-foreground" />
				<span aria-hidden="true" className="h-px w-4 bg-foreground" />
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes the onde-scope class for the page colors.
			    The [&>button] classes give the close button of the kit a touch area of 44px. */}
			<SheetContent
				side="end"
				className="onde-scope gap-0 overflow-y-auto overflow-x-clip border-(--onde-hair) bg-background font-sans text-foreground [&>button]:end-3 [&>button]:top-3 [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-md"
			>
				<SheetHeader className="relative z-3 border-(--onde-hair) border-b px-6 py-5">
					<SheetTitle className="font-display font-normal text-[1.62rem] leading-none">
						{t("site.brand")}
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuDescription")}
					</SheetDescription>
				</SheetHeader>
				<nav
					aria-label={t("site.navLabel")}
					className="relative z-3 flex flex-col px-6 pt-2"
				>
					{NAV_LINKS.map((link) => (
						<SheetClose key={link.href} asChild>
							<a
								href={link.href}
								className="flex min-h-14 items-center gap-3.5 border-(--onde-hair) border-b py-3 font-display text-[1.5rem] leading-tight no-underline transition-colors duration-[400ms] ease-(--onde-tide) hover:text-primary"
							>
								<PebbleGlyph className="h-[15px] w-4 text-(--onde-sage)" />
								{t(link.labelKey)}
							</a>
						</SheetClose>
					))}
				</nav>
				<div className="relative mt-auto grid gap-3 p-6">
					<SteamVeil kind="glow" phase={2} />
					<p className={cn(LABEL, "relative z-3")}>{t("site.phoneLabel")}</p>
					<a
						href={t("site.phoneHref")}
						aria-label={t("site.phoneAria")}
						className="relative z-3 inline-flex min-h-11 items-center font-display text-[1.35rem] tabular-nums no-underline"
					>
						{t("site.phoneDisplay")}
					</a>
					<SheetClose asChild>
						<a
							href="#book"
							className={cn(PRIMARY_BUTTON, "relative z-3 mt-2 w-full")}
						>
							{t("hero.primaryCta")}
						</a>
					</SheetClose>
				</div>
			</SheetContent>
		</Sheet>
	);
}
