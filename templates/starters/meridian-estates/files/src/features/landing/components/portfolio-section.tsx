// The portfolio: a lead panel and the three houses. On a phone they stack. From the md breakpoint they form
// a sideways scroll-snap row, with a progress rule, the plate count, and two arrow buttons under it.
// LandingPage renders it after the intro.
// usePortfolioRow follows the row; PropertyPanel draws each house from PORTFOLIO_HOUSES.
import { useRef } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { usePortfolioRow } from "../hooks/use-portfolio-row";
import { PORTFOLIO_HOUSES } from "../lib/content";
import { AccentWords } from "./accent-words";
import { PropertyPanel } from "./property-panel";

/** The two arrow buttons under the row, in reading order. The glyph turns in a right-to-left page. */
const ROW_ARROWS: readonly {
	direction: 1 | -1;
	label: TranslationKey;
	glyph: string;
}[] = [
	{ direction: -1, label: "portfolio.previous", glyph: "←" },
	{ direction: 1, label: "portfolio.next", glyph: "→" },
];

/** The section with id "portfolio". The wide row scrolls by touch, by trackpad, or with the arrow buttons. */
export function PortfolioSection() {
	const { t } = useT();
	const rowRef = useRef<HTMLDivElement>(null);
	const ruleRef = useRef<HTMLSpanElement>(null);
	const houseCount = PORTFOLIO_HOUSES.length;
	const { activeIndex, scrollByPanel } = usePortfolioRow(
		rowRef,
		ruleRef,
		houseCount,
	);
	const plateCount = String(houseCount).padStart(2, "0");
	return (
		<section
			id="portfolio"
			aria-labelledby="portfolio-title"
			className="scroll-mt-16 border-foreground/8 border-y bg-canvas"
		>
			<div ref={rowRef} className="mer-row">
				<div className="mer-gutter flex flex-col justify-center border-foreground/8 border-b pt-20 pb-14 md:min-h-[min(88svh,50rem)] md:w-[32vw] md:border-e md:border-b-0 md:py-16 xl:w-[30vw]">
					<p
						data-reveal
						className="mer-rise text-[0.6875rem] text-primary uppercase tracking-[0.22em]"
					>
						<span className="me-4 tabular-nums">{t("portfolio.range")}</span>
						{t("portfolio.label")}
					</p>
					<h2
						id="portfolio-title"
						data-reveal
						className="mer-rise mt-6 max-w-[9em] font-display text-[clamp(2.2rem,2.9vw,3.4rem)] leading-[1.05] tracking-[-0.012em] [--mer-step:1]"
					>
						<AccentWords
							start={t("portfolio.titleStart")}
							accent={t("portfolio.titleAccent")}
						/>
					</h2>
					<p
						data-reveal
						className="mer-rise mt-8 max-w-[30ch] text-[0.875rem] text-foreground/70 leading-[1.8] [--mer-step:2]"
					>
						{t("portfolio.note")}
					</p>
					<p className="mt-10 hidden items-center gap-4 text-[0.65625rem] text-foreground/55 uppercase tracking-[0.22em] md:flex">
						<span aria-hidden="true" className="h-px w-14 bg-primary/55" />
						{t("portfolio.hint")}
					</p>
				</div>
				{PORTFOLIO_HOUSES.map((house, index) => (
					<PropertyPanel
						key={house.id}
						house={house}
						isFlipped={index % 2 === 1}
					/>
				))}
			</div>

			<div className="mer-wrap hidden items-center gap-6 pt-2 pb-10 md:flex">
				<span
					aria-live="polite"
					className="whitespace-nowrap font-display text-[0.875rem] text-foreground/70 italic tabular-nums"
				>
					{String(activeIndex + 1).padStart(2, "0")}{" "}
					<span className="sr-only">{t("portfolio.of")}</span>
					<span aria-hidden="true">/</span> {plateCount}
				</span>
				<span
					aria-hidden="true"
					className="relative h-px flex-1 bg-foreground/14"
				>
					<span
						ref={ruleRef}
						className="mer-progress absolute inset-0 bg-primary"
					/>
				</span>
				<div className="flex gap-2">
					{ROW_ARROWS.map((arrow) => (
						<button
							key={arrow.direction}
							type="button"
							onClick={() => scrollByPanel(arrow.direction)}
							aria-label={t(arrow.label)}
							className="flex size-11 items-center justify-center border border-foreground/14 font-display text-[1.125rem] text-foreground/80 italic transition-colors duration-300 hover:border-primary hover:text-primary"
						>
							<span aria-hidden="true" className="inline-block rtl:rotate-180">
								{arrow.glyph}
							</span>
						</button>
					))}
				</div>
			</div>
		</section>
	);
}
