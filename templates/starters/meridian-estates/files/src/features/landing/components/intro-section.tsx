// The margin-note introduction of the practice: a narrow column with a bronze tick and one label,
// and a wide column that starts mid-thought with a serif lede and three colophon figures.
// On a wide screen the label sticks under the header while the lede passes, and the figures span the lede.
// LandingPage renders it after the hero. It has no heading on purpose: the lede is the voice.
import { type TranslationKey, useT } from "~/shared/i18n";
import { staggerStep } from "../lib/motion";
import { AccentWords } from "./accent-words";

/** The three figures under the lede, each as a value key and a label key. */
const PRACTICE_STATS: readonly {
	value: TranslationKey;
	label: TranslationKey;
}[] = [
	{ value: "intro.statEstablished", label: "intro.statEstablishedLabel" },
	{ value: "intro.statPlaced", label: "intro.statPlacedLabel" },
	{ value: "intro.statContinents", label: "intro.statContinentsLabel" },
];

/** A 1fr / 2.2fr grid on a wide screen, one column on a phone. */
export function IntroSection() {
	const { t } = useT();
	return (
		<section
			aria-label={t("intro.label")}
			className="mer-wrap pt-[clamp(6rem,14vh,11rem)] pb-[clamp(5rem,12vh,9rem)]"
		>
			<div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] md:gap-[clamp(2rem,6vw,7rem)]">
				<div
					data-reveal
					className="mer-rise flex flex-col gap-5 self-start md:sticky md:top-28"
				>
					<span aria-hidden="true" className="h-px w-11 bg-primary" />
					<p className="text-[0.6875rem] text-foreground/60 uppercase tracking-[0.22em]">
						{t("intro.label")}
					</p>
				</div>
				<div>
					<p
						data-reveal
						className="mer-rise max-w-[34em] font-display text-[clamp(1.5rem,3vw,2.6rem)] leading-[1.38] tracking-[-0.005em]"
					>
						<AccentWords
							start={t("intro.ledeStart")}
							accent={t("intro.ledeAccent")}
							end={t("intro.ledeEnd")}
						/>
					</p>
					<dl className="mt-[clamp(2.5rem,6vh,4rem)] grid grid-cols-3 gap-x-[clamp(1rem,4vw,3.5rem)] border-foreground/8 border-t pt-8">
						{PRACTICE_STATS.map((stat, step) => (
							<div
								key={stat.value}
								data-reveal
								className={`mer-rise flex flex-col-reverse justify-end gap-1.5 ${staggerStep(step)}`}
							>
								<dt className="text-[0.65625rem] text-foreground/55 uppercase tracking-[0.2em]">
									{t(stat.label)}
								</dt>
								<dd className="font-display text-[clamp(1.4rem,2.2vw,2rem)] tabular-nums">
									{t(stat.value)}
								</dd>
							</div>
						))}
					</dl>
				</div>
			</div>
		</section>
	);
}
