// The manifesto: a drawn breath wave, then one long sentence in the display serif, set phrase by phrase.
// LandingPage renders it after the hero. The scroll scrub lights each phrase in turn while the sentence
// crosses the screen. With no script, or with reduced motion, the whole sentence is lit.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollProgress } from "../hooks/use-scroll-progress";
import { SECTION_Y, WRAP } from "../lib/styles";

/** The sage words of the sentence. */
const EM = "text-primary italic";

/** The manifesto band, on the page bone. */
export function ManifestoSection() {
	const { t } = useT();
	const sentenceRef = useRef<HTMLParagraphElement>(null);
	// The phrases light from when the sentence top passes 78% of the screen until its bottom passes 52%.
	useScrollProgress(sentenceRef, "--manifesto", { startAt: 0.78, endAt: 0.52 });
	return (
		<section aria-label={t("manifesto.label")} className={SECTION_Y}>
			<div className={`${WRAP} max-w-[980px]`}>
				<svg
					viewBox="0 0 420 44"
					fill="none"
					aria-hidden="true"
					data-reveal
					className="sp-draw mb-[clamp(40px,6vw,64px)] w-[min(420px,70%)] text-(--sp-sage)"
				>
					<path
						pathLength={1}
						d="M2 22 C 37 4 72 40 107 22 S 177 4 212 22 S 282 40 317 22 S 387 4 418 22"
						stroke="currentColor"
						strokeWidth="1.6"
						strokeLinecap="round"
					/>
				</svg>
				<p
					ref={sentenceRef}
					className="sp-manifesto max-w-[24ch] font-display font-normal text-[clamp(1.85rem,4.4vw,3.55rem)] leading-[1.3] tracking-[-0.012em]"
				>
					<span className="sp-phrase">{t("manifesto.phrase1")}</span>
					<span className="sp-phrase">
						{t("manifesto.phrase2Lead")}
						<em className={EM}>{t("manifesto.phrase2Em")}</em>
						{t("manifesto.phrase2Tail")}
					</span>
					<span className="sp-phrase">{t("manifesto.phrase3")}</span>
					<span className="sp-phrase">{t("manifesto.phrase4")}</span>
					<span className="sp-phrase">
						{t("manifesto.phrase5Lead")}
						<em className={EM}>{t("manifesto.phrase5Em")}</em>
						{t("manifesto.phrase5Tail")}
					</span>
					<span className="sp-phrase">{t("manifesto.phrase6")}</span>
					<span className="sp-phrase">{t("manifesto.phrase7")}</span>
					<span className="sp-phrase">
						<em className={EM}>{t("manifesto.phrase8Em")}</em>
						{t("manifesto.phrase8Tail")}
					</span>
					<span className="sp-phrase">
						{t("manifesto.phrase9Lead")}
						<em className={EM}>{t("manifesto.phrase9Em")}</em>
						{t("manifesto.phrase9Tail")}
					</span>
				</p>
				<p className="mt-[clamp(36px,5vw,56px)] flex items-center gap-4 font-bold font-sans text-(--sp-ink-64) text-[0.8rem] uppercase tracking-[0.22em]">
					<span
						aria-hidden="true"
						className="h-px w-11 shrink-0 bg-(--sp-terra)"
					/>
					{t("manifesto.signature")}
				</p>
			</div>
		</section>
	);
}
