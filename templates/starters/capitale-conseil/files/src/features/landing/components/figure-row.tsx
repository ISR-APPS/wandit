// One pull-figure of the deep band: the giant serif value, its note, a full-width base rule, and a foot row.
// FiguresSection renders three of them. useEnterProgress gives the progress of the row through its entrance zone.
// The row fades in, the value counts from 0, the rule draws from the start edge, then the foot row arrives.
// On the server and with no script the progress is 1: the row is complete.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useEnterProgress } from "../hooks/use-enter-progress";
import type { PullFigure } from "../lib/content";
import { clampShare } from "../lib/scroll-store";
import { MICRO } from "../lib/type-styles";

type FigureRowProps = {
	figure: PullFigure;
};

/** Fast at the start, slow at the end. The count settles on its value with no overshoot. */
function easeOut(share: number): number {
	return 1 - (1 - share) ** 3;
}

/** The share of one beat that is done, when the beat runs from `start` to `end` of the row progress. */
function beatShare(progress: number, start: number, end: number): number {
	return easeOut(clampShare((progress - start) / (end - start)));
}

/** The row progress at which the count is complete and the copper rule lands. */
const COUNT_END = 0.85;

/** A row of the figures band. The spoken value is for screen readers: they must not read a moving count. */
export function FigureRow({ figure }: FigureRowProps) {
	const { t, locale } = useT();
	const rowRef = useRef<HTMLElement>(null);
	const progress = useEnterProgress(rowRef);
	const rowShare = beatShare(progress, 0, 0.4);
	const countShare = beatShare(progress, 0, COUNT_END);
	const ruleShare = beatShare(progress, 0.12, 0.75);
	const footShare = beatShare(progress, 0.3, 0.8);
	const isLanded = progress >= COUNT_END;
	// The locale writes the decimal sign: "4.2" in English, "4,2" in French.
	const shownValue = new Intl.NumberFormat(locale, {
		minimumFractionDigits: figure.decimals,
		maximumFractionDigits: figure.decimals,
	}).format(figure.value * countShare);
	return (
		// The ref is on the article, which never moves. The transforms are on its children.
		<article ref={rowRef} className="py-[clamp(0.9rem,2vh,1.4rem)]">
			<div
				className="grid grid-cols-1 gap-x-12 gap-y-2 transition-[opacity,transform] duration-200 ease-linear min-[56.25rem]:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] min-[56.25rem]:items-end"
				style={{
					opacity: rowShare,
					// 24px is the entrance distance of every block of the page.
					transform: `translateY(${(1 - rowShare) * 24}px)`,
				}}
			>
				<p className="whitespace-nowrap font-display font-normal text-[clamp(3.6rem,7vw,6.75rem)] lining-nums tabular-nums leading-[0.94] tracking-[-0.025em]">
					<span className="sr-only">{t(`figures.${figure.id}.spoken`)}</span>
					<span aria-hidden="true">
						{shownValue}
						{figure.suffix !== null && t(figure.suffix)}
						{figure.unit !== null && (
							<span className="ms-[0.32em] text-(--cap-band-note) text-[0.32em] tracking-[0.01em]">
								{t(figure.unit)}
							</span>
						)}
					</span>
				</p>
				<p
					className="max-w-[40ch] text-(--cap-band-note) text-[0.90625rem] transition-opacity duration-200 ease-linear min-[56.25rem]:pb-2"
					style={{ opacity: footShare }}
				>
					{t(`figures.${figure.id}.note`)}
				</p>
			</div>
			<div
				aria-hidden="true"
				className={cn(
					"mt-2.5 origin-left transition-[transform,background-color,height] duration-300 ease-out rtl:origin-right",
					// Copper use 2 of 2: the base rule of the figure that closes the count.
					figure.isCopper && isLanded
						? "h-0.5 bg-warning"
						: "h-px bg-background/28",
				)}
				style={{ transform: `scaleX(${ruleShare})` }}
			/>
			<div
				className="flex flex-wrap justify-between gap-x-6 gap-y-1.5 pt-2.5 transition-opacity duration-200 ease-linear"
				style={{ opacity: footShare }}
			>
				<span className={cn(MICRO, "text-(--cap-band-soft)")}>
					{t(`figures.${figure.id}.label`)}
				</span>
				{/* ms-auto keeps the source at the end edge when it wraps to its own line. */}
				<span
					className={cn(MICRO, "ms-auto text-(--cap-band-faint) tabular-nums")}
				>
					{t(`figures.${figure.id}.source`)}
				</span>
			</div>
		</article>
	);
}
