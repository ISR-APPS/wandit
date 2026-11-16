// The phone menu: a header button that opens a side panel with the five sections, the telephone, and the call to action.
// SiteHeader renders it. It shows below 1024px, where the header has no room for the tabs.
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
import { CONSULTATION_HREF, SECTIONS } from "../lib/content";
import { BUTTON_TEXT, LABEL } from "../lib/type-styles";
import { Wordmark } from "./wordmark";

/** A 44px square button with two brass hairlines. The panel lists the sections as numbered folder rows. */
export function SiteMenu() {
	const { t } = useT();
	const [isOpen, setIsOpen] = useState(false);
	const close = () => setIsOpen(false);
	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger
				aria-label={t("site.menuOpen")}
				className="vt-line inline-flex size-11 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xs border transition-colors hover:border-primary lg:hidden"
			>
				<span aria-hidden="true" className="h-px w-4.5 bg-primary" />
				<span aria-hidden="true" className="h-px w-4.5 bg-primary" />
			</SheetTrigger>
			{/* The panel renders outside the page root, so it takes the vt-scope class for the page inks.
			    The [&>button] classes give the close button of the kit a touch area of 44px. */}
			<SheetContent
				side="end"
				className="vt-scope gap-0 tracking-normal [&>button]:end-3 [&>button]:top-3 [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
			>
				<SheetHeader className="vt-line border-b px-6 py-5">
					<SheetTitle className="font-normal text-[1.1rem]">
						<Wordmark />
					</SheetTitle>
					<SheetDescription className="sr-only">
						{t("site.menuDescription")}
					</SheetDescription>
				</SheetHeader>
				<nav aria-label={t("site.navLabel")} className="flex flex-col px-6">
					{SECTIONS.map((section, index) => (
						<a
							key={section.href}
							href={section.href}
							onClick={close}
							className="vt-faint flex min-h-15 items-baseline gap-4 border-b py-4 transition-colors hover:text-(--vt-brass)"
						>
							<span className={cn(LABEL, "w-6 text-(--vt-brass) tabular-nums")}>
								{String(index + 1).padStart(2, "0")}
							</span>
							<span className="font-display text-[1.35rem] leading-tight">
								{t(section.label)}
							</span>
						</a>
					))}
				</nav>
				<div className="mt-auto grid gap-3 p-6">
					<a
						href={t("site.phoneHref")}
						className={cn("vt-btn vt-btn-ghost tabular-nums", BUTTON_TEXT)}
					>
						{t("site.phoneDisplay")}
					</a>
					<a
						href={CONSULTATION_HREF}
						onClick={close}
						className={cn("vt-btn", BUTTON_TEXT)}
					>
						{t("hero.ctaConsultation")}
					</a>
				</div>
			</SheetContent>
		</Sheet>
	);
}
