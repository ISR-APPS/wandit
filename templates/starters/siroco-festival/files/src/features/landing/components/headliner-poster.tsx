// One poster of the headliner paste-up: a pasted edge with the day, the stage, and the time,
// then the fitted name, the genre, the stage time in big numerals, and two notes.
// HeadlinersSection renders four of them. landing.css makes each one stick one edge lower than the last.
import type { CSSProperties } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { Headliner } from "../lib/content";
import { GUTTER, SHEET } from "../lib/type-styles";
import { FittedLine } from "./fitted-line";

type HeadlinerPosterProps = {
	headliner: Headliner;
	/** Position in the paste-up, from 0. It sets the sticky top: index times one pasted edge. */
	index: number;
};

/** A full-screen sheet. When the next poster covers it, only its edge row stays in view, as an index. */
export function HeadlinerPoster({ headliner, index }: HeadlinerPosterProps) {
	const { t } = useT();
	const style: CSSProperties & Record<"--sf-k", number> = { "--sf-k": index };
	const name = t(headliner.nameKey);
	// "Azur Azur" repeats a word, so each word gets its position in its id.
	const words = name.split(" ").map((text, position) => ({
		id: `${headliner.id}-${position}`,
		text,
		fit: headliner.stackFits[position] ?? headliner.fit,
		isFirst: position === 0,
	}));
	return (
		<article
			aria-labelledby={`poster-${headliner.id}`}
			className={cn(
				SHEET[headliner.ground],
				"sf-poster flex flex-col",
				words.length === 1 && "sf-poster-short",
			)}
			style={style}
		>
			<p
				className={cn(
					GUTTER,
					"sf-poster-edge flex shrink-0 items-center justify-between gap-4 overflow-clip whitespace-nowrap font-bold text-[clamp(0.78rem,1.4vw,1rem)] uppercase tracking-[0.07em]",
				)}
			>
				<span>
					{t(headliner.dayKey)}
					<span className="hidden sm:inline"> — {t(headliner.stageKey)}</span>
					<span> · {name}</span>
				</span>
				<span className="tabular-nums">{headliner.time}</span>
			</p>
			<div className="flex min-h-0 flex-1 flex-col justify-center">
				<h3 id={`poster-${headliner.id}`}>
					<FittedLine
						text={name}
						fit={headliner.fit}
						cap="62svh"
						className="hidden md:block"
					/>
					{/* A phone poster stacks one word per line, so the name fills the tall sheet.
					    The 36px gap leaves room for a capital accent, as in FANTÔME. */}
					<span className="block md:hidden">
						{words.map((word) => (
							<FittedLine
								key={word.id}
								text={word.text}
								fit={word.fit}
								cap="34svh"
								className={word.isFirst ? undefined : "mt-9"}
							/>
						))}
					</span>
				</h3>
				<div
					className={cn(
						GUTTER,
						"mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-2",
					)}
				>
					<p className="font-display text-[clamp(1.4rem,2.6vw,2.2rem)] uppercase leading-tight tracking-[0.03em]">
						{t(headliner.genreKey)}
					</p>
					<p className="ms-auto font-display text-[clamp(3.4rem,6vw,5.5rem)] tabular-nums leading-none">
						<span className="sr-only">{t(headliner.stageKey)} </span>
						{headliner.time}
					</p>
				</div>
			</div>
			<div className={cn(GUTTER, "shrink-0 pb-[4.5vh]")}>
				<ul className="flex flex-col gap-x-10 gap-y-1.5 border-current/40 border-t-2 pt-4 font-semibold text-[clamp(0.95rem,1.3vw,1.1rem)] sm:flex-row sm:flex-wrap">
					{headliner.noteKeys.map((noteKey) => (
						<li key={noteKey}>{t(noteKey)}</li>
					))}
				</ul>
			</div>
		</article>
	);
}
