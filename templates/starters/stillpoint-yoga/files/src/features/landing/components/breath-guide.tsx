// The small breathing guide under the hero buttons: a ring, a clay core, a clay arc, and the breath words.
// HeroSection renders it. The 14s CSS clock of landing.css drives it: inhale four counts, hold four, exhale six.
// With reduced motion the words give way to one still line, and the ring stays at rest.
import { useT } from "~/shared/i18n";

/** The guide. The ring and the words are decorative; the still line carries the same rhythm as text. */
export function BreathGuide() {
	const { t } = useT();
	return (
		<div className="mt-11 flex flex-col items-center">
			<div
				aria-hidden="true"
				className="sp-guide sp-breathe relative flex size-14 items-center justify-center rounded-full border-(--sp-sage) border-[1.5px]"
			>
				<svg
					viewBox="0 0 68 68"
					aria-hidden="true"
					className="sp-guide-arc absolute -inset-[7px] -rotate-90 overflow-visible"
				>
					<circle cx="34" cy="34" r="32.5" pathLength="100" />
				</svg>
				<i className="sp-core-pulse block size-[9px] rounded-full bg-(--sp-terra)" />
			</div>
			<p
				aria-hidden="true"
				className="sp-words relative mt-5 h-[22px] w-full min-w-[18rem] font-bold font-sans text-(--sp-ink-64) text-[0.75rem] uppercase"
			>
				<span data-phase="in">{t("hero.breatheIn")}</span>
				<span data-phase="hold">{t("hero.breatheHold")}</span>
				<span data-phase="out">{t("hero.breatheOut")}</span>
			</p>
			<p className="sp-words-still mt-5 font-bold font-sans text-(--sp-ink-64) text-[0.75rem] uppercase tracking-[0.3em]">
				{t("hero.breatheStill")}
			</p>
		</div>
	);
}
