// The phone menu: a header button that opens a side panel with the section links, the telephone, and the quote action.
// SiteHeader renders it. It shows below 1024px, where the header has no room for the links.
// The panel is the kit Sheet. Each link is a SheetClose: a click closes the panel, then the browser goes to the section.
import { useT } from "~/shared/i18n";
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
import { META_SMALL } from "../lib/type-styles";
import { TicketLink } from "./ticket-link";
import { Wordmark } from "./wordmark";

/** A square button of 44px with two hairlines. The panel lists the sections in the display serif, on hairlines. */
export function SiteMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger
				aria-label={t("site.menuOpen")}
				className="inline-flex size-11 shrink-0 flex-col items-center justify-center gap-[7px] border border-(--hz-hair) transition-colors duration-200 hover:border-(--hz-sun) lg:hidden"
			>
				<span aria-hidden="true" className="h-px w-[18px] bg-foreground" />
				<span aria-hidden="true" className="h-px w-[18px] bg-(--hz-sun)" />
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes the hz-scope class for the page variables.
			    The [&>button] classes give the close button of the kit a touch area of 44px. */}
			<SheetContent
				side="end"
				className="hz-scope gap-0 overflow-y-auto bg-background tracking-normal [&>button]:end-3 [&>button]:top-3.5 [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
			>
				<SheetHeader className="border-(--hz-hair) border-b px-6 py-6">
					<SheetTitle className="font-normal">
						<Wordmark className="text-[1.25rem]" />
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuDescription")}
					</SheetDescription>
				</SheetHeader>
				{/* The sun rule of the page crosses the panel too, under the header. */}
				<span aria-hidden="true" className="block h-0.5 bg-(--hz-sun)" />
				<nav aria-label={t("site.navLabel")} className="flex flex-col px-6">
					{NAV_LINKS.map((link, index) => (
						<SheetClose key={link.href} asChild>
							<a
								href={link.href}
								className="flex min-h-14 items-baseline gap-4 border-(--hz-hair) border-b py-3.5 font-display text-[1.4rem] leading-tight transition-colors duration-200 hover:text-(--hz-ink-soft)"
							>
								<span className={`${META_SMALL} w-6 shrink-0`}>
									{String(index + 1).padStart(2, "0")}
								</span>
								{t(link.labelKey)}
							</a>
						</SheetClose>
					))}
				</nav>
				<div className="mt-auto grid gap-5 p-6">
					<a
						href={t("site.phoneHref")}
						className="inline-flex min-h-11 items-center justify-between gap-4 border-(--hz-hair) border-b font-display text-[1.25rem]"
					>
						<span className={META_SMALL}>{t("site.phoneLabel")}</span>
						{t("site.phoneDisplay")}
					</a>
					<SheetClose asChild>
						<TicketLink
							href="#quote"
							code={t("site.ticketCode")}
							className="justify-between"
						>
							{t("hero.cta")}
						</TicketLink>
					</SheetClose>
				</div>
			</SheetContent>
		</Sheet>
	);
}
