// The first screen: tag, the big promise with a highlighter word and a squiggle word, the lede, two buttons,
// the proof row, and ChompyStage. LandingPage renders it first. landing.css plays the entrance on load.
import { Fragment } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BUTTON, BUTTON_BIG, DISPLAY, TAG, WRAP } from "../lib/styles";
import { ChompyStage } from "./chompy-stage";
import { DoodleStar } from "./doodle-star";

/** One `.gd-word` span per word of a plain title phrase. landing.css raises the words one by one on load. */
function wordSpans(phrase: string) {
	// The character offset of each word is unique in the phrase, so it is the key.
	let offset = 0;
	return phrase.split(" ").map((word) => {
		const start = offset;
		offset += word.length + 1;
		return (
			<Fragment key={start}>
				{start > 0 && " "}
				<span className="gd-word">{word}</span>
			</Fragment>
		);
	});
}

/** Two columns from 1024px: the words start, Chompy end. On a phone Chompy sits under the buttons. */
export function HeroSection() {
	const { t } = useT();
	return (
		<section
			id="top"
			aria-label={t("hero.label")}
			className="relative overflow-clip pt-[clamp(120px,16vh,170px)] pb-[clamp(40px,6vw,80px)]"
		>
			<div
				className={cn(
					WRAP,
					"relative grid items-center gap-[clamp(2.5rem,4vw,3.5rem)] lg:grid-cols-[1.05fr_0.95fr]",
				)}
			>
				<div>
					<p
						className={cn(
							TAG,
							"gd-intro-tag mb-6 -rotate-[2.5deg] bg-(--gd-sun)",
						)}
					>
						{t("hero.tag")}
					</p>
					<h1
						className={cn(
							DISPLAY,
							"mb-6 text-balance text-[clamp(3rem,6.7vw,6.1rem)] leading-[0.98]",
						)}
					>
						{wordSpans(t("hero.titleLead"))}{" "}
						<span className="gd-word">
							<span className="gd-highlight">{t("hero.titleHighlight")}</span>
						</span>{" "}
						{wordSpans(t("hero.titleMid"))}{" "}
						<span className="gd-word">
							<span className="gd-squiggle">
								{t("hero.titleUnderline")}
								<svg
									viewBox="0 0 120 14"
									preserveAspectRatio="none"
									aria-hidden="true"
									focusable="false"
								>
									<path
										d="M2 9 Q12 3 22 9 T42 9 T62 9 T82 9 T102 9 T118 9"
										fill="none"
										strokeWidth="5"
										strokeLinecap="round"
										vectorEffect="non-scaling-stroke"
										className="stroke-primary"
									/>
								</svg>
							</span>
						</span>{" "}
						{wordSpans(t("hero.titleEnd"))}
					</h1>
					<p className="gd-intro-late mb-8 max-w-[34rem] text-[clamp(1.1rem,1.5vw,1.3rem)] leading-relaxed">
						{t("hero.lede")}
					</p>
					<div className="gd-intro-late mb-7 flex flex-wrap items-center gap-4">
						<a href="#book" className={BUTTON_BIG}>
							{t("hero.bookFirst")}
						</a>
						<a href="#prices" className={cn(BUTTON, "gd-btn-white")}>
							{t("hero.peekPrices")}
						</a>
					</div>
					{/* Under 1280px the rating takes its own line, so no dot starts a line. */}
					<ul className="gd-intro-late flex flex-wrap items-center gap-x-6 gap-y-1.5 font-bold text-[0.95rem]">
						<li className="flex items-center gap-2 whitespace-nowrap max-xl:basis-full">
							<span
								aria-hidden="true"
								className="text-primary tracking-[0.1em]"
							>
								★★★★★
							</span>
							<span className="sr-only">{t("hero.proofRatingLabel")}</span>
							<span aria-hidden="true">{t("hero.proofRating")}</span>
						</li>
						<li className="relative whitespace-nowrap before:absolute before:start-[-0.95rem] before:top-[0.6em] before:size-1.5 before:rounded-full before:bg-foreground/28 max-xl:before:hidden">
							{t("hero.proofSaturday")}
						</li>
						<li className="relative whitespace-nowrap before:absolute before:start-[-0.95rem] before:top-[0.6em] before:size-1.5 before:rounded-full before:bg-foreground/28">
							{t("hero.proofSameDay")}
						</li>
					</ul>
				</div>
				<div className="relative">
					<ChompyStage />
					<DoodleStar className="absolute start-[6%] top-[16%] w-11 -rotate-14 fill-primary max-lg:hidden" />
					<DoodleStar className="absolute end-[14%] bottom-[14%] w-7.5 rotate-18 fill-(--gd-teal)" />
					<svg
						viewBox="0 0 100 24"
						aria-hidden="true"
						focusable="false"
						className="pointer-events-none absolute start-[22%] bottom-[-2%] w-20"
					>
						<path
							d="M4 16 Q14 4 24 14 T44 14 T64 14 T84 14 T96 12"
							fill="none"
							strokeWidth="5"
							strokeLinecap="round"
							className="stroke-(--gd-sun)"
						/>
					</svg>
				</div>
			</div>
		</section>
	);
}
