// The phone menu: a header button that opens a side panel with the five movements.
// SiteHeader renders it. It shows below 1024px, where the header has no room for the links.
// The panel is the kit Sheet. A click on a link closes it, then the browser goes to the section.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/shared/ui/sheet";
import { CONTACT_HREF, MOVEMENTS } from "../lib/content";
import { BUTTON_GHOST, BUTTON_PRIMARY } from "../lib/type-styles";
import { Wordmark } from "./wordmark";

/** A square button of 44px with a two-line mark. The panel lists the movements, the telephone, and the meeting action. */
export function SiteMenu() {
	const { t } = useT();
	const [isOpen, setIsOpen] = useState(false);
	const close = () => setIsOpen(false);
	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger
				aria-label={t("site.menuOpen")}
				className="inline-flex size-11 shrink-0 flex-col items-center justify-center gap-1.5 border border-foreground/18 transition-colors duration-[180ms] ease-linear hover:border-foreground lg:hidden"
			>
				<span aria-hidden="true" className="h-px w-4.5 bg-foreground" />
				<span aria-hidden="true" className="h-px w-4.5 bg-foreground" />
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes the cap-scope class for the page colors.
			    The [&>button] classes give the close button of the kit a touch area of 44px and a square hairline focus ring. */}
			<SheetContent
				side="end"
				className="cap-scope gap-0 tracking-normal [&>button]:end-3 [&>button]:top-2.5 [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-none [&>button]:focus:ring-1 [&>button]:focus:ring-offset-0"
			>
				<SheetHeader className="border-foreground/12 border-b px-6 py-5">
					<SheetTitle className="font-normal">
						<Wordmark className="text-xl" />
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuDescription")}
					</SheetDescription>
				</SheetHeader>
				<nav aria-label={t("site.navLabel")} className="flex flex-col px-6">
					{MOVEMENTS.map((movement) => (
						<a
							key={movement.href}
							href={movement.href}
							onClick={close}
							className="flex min-h-15 items-baseline gap-4 border-foreground/12 border-b py-4 transition-colors duration-[180ms] ease-linear hover:text-primary"
						>
							<span className="w-6 font-semibold text-[0.6875rem] text-primary tabular-nums tracking-[0.1em]">
								{movement.numeral}
							</span>
							<span className="font-display text-[1.4rem] leading-tight tracking-[-0.015em]">
								{t(movement.label)}
							</span>
						</a>
					))}
				</nav>
				<div className="mt-auto grid gap-3 p-6">
					<a
						href={t("site.phoneHref")}
						className={cn(BUTTON_GHOST, "tabular-nums")}
					>
						{t("site.phoneDisplay")}
					</a>
					<a href={CONTACT_HREF} onClick={close} className={BUTTON_PRIMARY}>
						{t("hero.ctaMeeting")}
					</a>
				</div>
			</SheetContent>
		</Sheet>
	);
}
