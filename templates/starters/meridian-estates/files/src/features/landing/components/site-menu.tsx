// The phone menu of the home page: a two-bar button that opens a full-screen sheet with numbered serif links.
// SiteHeader renders it and owns the open state, so the header stays in view while the sheet is open.
// It uses the Sheet of the kit. A link click closes the sheet, then the browser follows the anchor.
import { useT } from "~/shared/i18n";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetTitle,
	SheetTrigger,
} from "~/shared/ui/sheet";
import { SECTION_LINKS } from "../lib/content";

type SiteMenuProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** The menu button and its sheet. The button shows below the md breakpoint only. */
export function SiteMenu({ open, onOpenChange }: SiteMenuProps) {
	const { t } = useT();
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetTrigger
				aria-label={t("nav.openMenu")}
				className="-me-2 flex size-11 flex-col items-center justify-center gap-1.5 md:hidden"
			>
				<span className="block h-px w-6 bg-foreground" />
				<span className="block h-px w-6 bg-foreground" />
			</SheetTrigger>
			<SheetContent
				side="end"
				className="mer-gutter w-full justify-center gap-0 bg-card sm:max-w-none"
			>
				<SheetTitle className="sr-only">{t("nav.menuTitle")}</SheetTitle>
				<nav aria-label={t("nav.label")}>
					<ol>
						{SECTION_LINKS.map((link, index) => (
							<li key={link.id}>
								<SheetClose asChild>
									<a
										href={`#${link.id}`}
										className="flex items-baseline gap-4 border-foreground/8 border-b py-3 font-display text-[clamp(2.2rem,9vw,3.4rem)] text-foreground leading-tight"
									>
										<span className="font-sans text-[0.75rem] text-primary tracking-[0.2em]">
											{String(index + 1).padStart(2, "0")}
										</span>
										{t(link.label)}
									</a>
								</SheetClose>
							</li>
						))}
					</ol>
				</nav>
				<SheetDescription className="mt-10 text-[0.6875rem] text-foreground/55 uppercase tracking-[0.2em]">
					{t("nav.menuNote")}
				</SheetDescription>
			</SheetContent>
		</Sheet>
	);
}
