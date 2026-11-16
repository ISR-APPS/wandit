// The section menu of the phone masthead: a "Sections" button that opens a side panel with every rubric and its page.
// Masthead renders it under 720px. It uses the Sheet of the kit and RUBRICS of lib/content.ts.
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
import { RUBRICS } from "../lib/content";
import { FURNITURE } from "../lib/type-styles";

/** A 48px caps button. A tap on a rubric closes the panel, then the page goes to the section. */
export function SectionMenu() {
	const { t } = useT();
	return (
		<Sheet>
			<SheetTrigger asChild>
				<button
					type="button"
					aria-label={t("site.menuOpenLabel")}
					className={cn(
						FURNITURE,
						"flex min-h-12 items-center gap-2.5 pe-4 font-bold text-[0.74rem] tracking-[0.11em] transition-colors hover:text-primary focus-visible:text-primary",
					)}
				>
					<ListIcon className="size-5" />
					{t("site.menuOpen")}
				</button>
			</SheetTrigger>
			{/* The last rule group makes the close button of the kit a 44px square touch target. */}
			<SheetContent
				side="end"
				className="ks-panel w-[min(88vw,360px)] gap-0 rounded-none border-foreground border-s-4 bg-background [&>button:last-child]:end-2 [&>button:last-child]:top-3 [&>button:last-child]:flex [&>button:last-child]:size-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center [&>button:last-child]:rounded-none [&>button:last-child]:opacity-100"
			>
				<SheetHeader className="border-(--ks-rule-strong) border-b px-6 pt-6 pb-4">
					<SheetTitle className="font-display font-extrabold text-3xl leading-none">
						{t("site.brand")}
					</SheetTitle>
					<SheetDescription
						className={cn(
							FURNITURE,
							"text-[0.7rem] text-foreground/62 tracking-[0.12em]",
						)}
					>
						{t("site.menuTitle")} · {t("site.edition")}
					</SheetDescription>
				</SheetHeader>
				<nav aria-label={t("site.navLabel")} className="px-6">
					<ul>
						{RUBRICS.map((rubric) => (
							<li key={rubric.href} className="border-(--ks-rule) border-b">
								<SheetClose asChild>
									<a
										href={rubric.href}
										className="flex min-h-14 items-baseline justify-between gap-4 py-4 font-bold font-display text-[1.6rem] leading-none transition-colors hover:text-primary focus-visible:text-primary"
									>
										{t(rubric.labelKey)}
										<span
											className={cn(
												FURNITURE,
												"font-bold text-[0.72rem] text-primary tracking-[0.12em]",
											)}
										>
											{t("site.pageAbbr")} {rubric.page}
										</span>
									</a>
								</SheetClose>
							</li>
						))}
					</ul>
				</nav>
				<SheetFooter className="px-6 pb-8">
					<p
						className={cn(
							FURNITURE,
							"text-[0.7rem] text-foreground/62 tracking-[0.12em]",
						)}
					>
						{t("site.menuHours")}
					</p>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
