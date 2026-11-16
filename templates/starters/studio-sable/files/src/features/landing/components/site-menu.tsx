// The section menu of a phone: a "menu" button in the header that opens a full-screen panel.
// SiteHeader renders it below 640px, where the four links do not fit beside the wordmark.
// It uses the Sheet of the kit. A tap on a link closes the panel, then the browser jumps to the section.
import { useT } from "~/shared/i18n";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetTitle,
	SheetTrigger,
} from "~/shared/ui/sheet";
import { NAV_LINKS } from "../lib/nav-links";
import { MONO, ROW_NAME, SQUARE, WRAP } from "../lib/type-styles";
import { Wordmark } from "./wordmark";

const MENU_BUTTON =
	"sable-mono inline-flex h-11 items-center gap-2.5 text-[12px] uppercase tracking-[0.08em]";

/** The phone menu. Its rows repeat the ledger of the index: a number, a large lowercase name, an arrow. */
export function SiteMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger className={`${MENU_BUTTON} ms-auto sm:hidden`}>
				<span aria-hidden="true" className={`${SQUARE} bg-primary`} />
				{t("site.menu")}
			</SheetTrigger>
			{/* The kit close button is a 16px icon. This panel hides it and gives a 44px text button.
			    The header is not sticky. Focus on the menu button scrolls the page back to the top, so the close does not move focus there. */}
			<SheetContent
				side="top"
				onCloseAutoFocus={(event) => event.preventDefault()}
				className="sable-page h-svh gap-0 overflow-y-auto border-0 text-[17px] tracking-normal [&>button]:hidden"
			>
				<div
					className={`${WRAP} flex min-h-[68px] items-center justify-between border-foreground/14 border-b`}
				>
					<SheetTitle className="font-display font-medium text-[19px] tracking-[-0.03em]">
						<Wordmark />
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuTitle")}
					</SheetDescription>
					<SheetClose className={MENU_BUTTON}>{t("site.menuClose")}</SheetClose>
				</div>
				<nav aria-label={t("site.navLabel")} className={`${WRAP} pt-6`}>
					<ul className="border-foreground border-t">
						{NAV_LINKS.map((link) => (
							<li key={link.href}>
								<SheetClose asChild>
									<a
										href={link.href}
										className="grid min-h-[76px] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3.5 border-foreground/14 border-b transition-colors duration-150 hover:text-primary focus-visible:text-primary"
									>
										<span className="sable-mono text-[12px] text-foreground/30">
											{link.number}
										</span>
										<span className={ROW_NAME}>{t(link.labelKey)}</span>
										<span
											aria-hidden="true"
											className="sable-arrow text-[19px] text-foreground/30 rtl:-scale-x-100"
										>
											→
										</span>
									</a>
								</SheetClose>
							</li>
						))}
					</ul>
				</nav>
				<div
					className={`${WRAP} ${MONO} mt-auto flex flex-col pt-8 pb-6 text-foreground/55`}
				>
					<span>{t("site.availability")}</span>
					<a
						href={t("site.emailHref")}
						className="inline-flex min-h-11 items-center text-foreground"
					>
						{t("site.email")}
					</a>
					<a
						href={t("site.phoneHref")}
						className="inline-flex min-h-11 items-center text-foreground"
					>
						{t("site.phone")}
					</a>
				</div>
			</SheetContent>
		</Sheet>
	);
}
