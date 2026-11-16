// The footer of the page is the title block of the drawing: the studio name in the large cell, then
// project, scale, drawn by, date, sheet, and telephone, and a base line with the address and the section links.
// LandingPage renders it last. Nothing comes after it. The date cell holds the month of the visit.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useCurrentMonth } from "../hooks/use-current-month";
import { SECTION_LINKS } from "../lib/content";
import { CELL_KEY, LABEL } from "../lib/styles";
import { Wordmark } from "./wordmark";

/** Four columns from 800px, the name cell two rows tall. Two columns on a phone, the name cell on top. */
export function CartoucheFooter() {
	const { t } = useT();
	const month = useCurrentMonth();
	const cells = [
		{ label: t("footer.project"), value: t("footer.projectValue") },
		{ label: t("footer.scale"), value: t("footer.scaleValue") },
		{ label: t("footer.drawnBy"), value: t("footer.drawnByValue") },
		{ label: t("footer.date"), value: month ?? "" },
		{ label: t("footer.sheet"), value: t("footer.sheetValue") },
		{ label: t("footer.phone"), value: t("site.phoneDisplay") },
	];
	return (
		<footer className="border-foreground border-t-2 bg-card">
			<h2 className="sr-only">{t("footer.label")}</h2>
			<div className="grid grid-cols-2 min-[50rem]:grid-cols-[2.3fr_1fr_1fr_1.35fr]">
				<div className="col-span-2 flex flex-col justify-center gap-1.5 border-foreground/20 border-b px-4 py-4 md:px-5 min-[50rem]:col-span-1 min-[50rem]:row-span-2 min-[50rem]:border-e">
					<Wordmark className="text-[clamp(1.4rem,2.4vw,2rem)]" />
					<span
						className={`${LABEL} font-normal text-[0.59375rem] text-foreground/70 tracking-[0.12em]`}
					>
						{t("footer.legal")}
					</span>
				</div>
				{cells.map((cell, index) => (
					<div
						key={cell.label}
						className={cn(
							"min-w-0 border-foreground/20 border-b px-4 py-4 md:px-5",
							// The inner rules: every first cell of a phone row, and the first two cells of a wide row.
							index % 2 === 0 && "border-e",
							index % 3 !== 2
								? "min-[50rem]:border-e"
								: "min-[50rem]:border-e-0",
						)}
					>
						<span className={CELL_KEY}>{cell.label}</span>
						<span className="mt-1 block min-h-[1.2em] truncate font-display text-xs tabular-nums tracking-[0.03em]">
							{cell.value}
						</span>
					</div>
				))}
			</div>
			{/* The 16px phone gutter matches the page column. On a phone the links spread over one full row. */}
			<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3.5 md:px-5">
				<span
					className={`${LABEL} font-normal text-[0.625rem] text-foreground/70 tracking-[0.06em]`}
				>
					{t("footer.copyright")}
				</span>
				<nav
					aria-label={t("site.footerNavLabel")}
					className="flex w-full flex-wrap justify-between gap-x-5 sm:w-auto sm:justify-start sm:gap-x-6"
				>
					{SECTION_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className={`${LABEL} ns-underline inline-flex min-h-11 items-center text-foreground`}
						>
							{t(link.label)}
						</a>
					))}
				</nav>
			</div>
		</footer>
	);
}
