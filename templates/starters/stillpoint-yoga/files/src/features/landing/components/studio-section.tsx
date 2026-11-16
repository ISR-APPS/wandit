// The studio: a head, the drawn room at seven in the morning, four numbers, and the room copy with three facts.
// LandingPage renders it after the schedule. The numbers agree with the grid: 21 classes a week.
import { useT } from "~/shared/i18n";
import { SECTION_TITLE, SECTION_Y, WRAP } from "../lib/styles";
import { Eyebrow } from "./eyebrow";
import { StudioRoom } from "./studio-room";

/** The four numbers of the studio, each as a value key, an optional unit key, and a label key. */
const NUMBERS = [
	{ valueKey: "studio.matsValue", labelKey: "studio.matsLabel" },
	{
		valueKey: "studio.heatValue",
		unitKey: "studio.heatUnit",
		labelKey: "studio.heatLabel",
	},
	{ valueKey: "studio.classesValue", labelKey: "studio.classesLabel" },
	{ valueKey: "studio.mirrorsValue", labelKey: "studio.mirrorsLabel" },
] as const;

/** The three fact rows under the room copy. */
const FACTS = [
	{ labelKey: "studio.fact1Label", valueKey: "studio.fact1Value" },
	{ labelKey: "studio.fact2Label", valueKey: "studio.fact2Value" },
	{ labelKey: "studio.fact3Label", valueKey: "studio.fact3Value" },
] as const;

/** The studio section, anchor #studio. */
export function StudioSection() {
	const { t } = useT();
	return (
		<section id="studio" aria-labelledby="studio-title" className={SECTION_Y}>
			<div className={`${WRAP} mb-[clamp(48px,7vw,84px)]`}>
				<Eyebrow>{t("studio.eyebrow")}</Eyebrow>
				<h2
					id="studio-title"
					data-reveal
					className={`${SECTION_TITLE} mt-[22px] max-w-[16ch]`}
				>
					{t("studio.titleLead")}{" "}
					<em className="whitespace-nowrap italic">{t("studio.titleEm")}</em>
				</h2>
			</div>
			<StudioRoom />
			<ul
				aria-label={t("studio.numbersLabel")}
				data-reveal-group
				className={`${WRAP} mt-[clamp(52px,7vw,88px)] grid list-none grid-cols-2 gap-[26px] md:grid-cols-4 md:gap-[clamp(18px,3vw,44px)]`}
			>
				{NUMBERS.map((number) => (
					<li
						key={number.labelKey}
						data-reveal
						className="border-(--sp-line) border-t pt-5"
					>
						<span className="flex items-baseline font-display text-[clamp(2.7rem,4.6vw,4rem)] tabular-nums leading-none">
							{t(number.valueKey)}
							{"unitKey" in number ? (
								<span className="ms-0.5 text-(--sp-terra-ink) text-[0.5em]">
									{t(number.unitKey)}
								</span>
							) : null}
						</span>
						<span className="mt-3 block font-bold font-sans text-(--sp-ink-64) text-[0.72rem] uppercase tracking-[0.22em]">
							{t(number.labelKey)}
						</span>
					</li>
				))}
			</ul>
			<div
				className={`${WRAP} mt-[clamp(48px,7vw,84px)] grid items-start gap-[clamp(30px,5vw,80px)] md:grid-cols-[1.1fr_0.9fr]`}
			>
				<h3
					data-reveal
					className="max-w-[14ch] font-display font-normal text-[clamp(2rem,4vw,3.2rem)] leading-[1.08] tracking-[-0.015em] md:sticky md:top-[120px]"
				>
					{t("studio.copyLead")}{" "}
					<em className="text-primary italic">{t("studio.copyEm")}</em>{" "}
					{t("studio.copyTail")}
				</h3>
				<div data-reveal>
					<p className="mb-[1.2em] text-pretty text-(--sp-ink-78)">
						{t("studio.paragraph1")}
					</p>
					<p className="mb-[1.2em] text-pretty text-(--sp-ink-78)">
						{t("studio.paragraph2")}
					</p>
					<ul className="mt-2 list-none border-(--sp-line) border-t">
						{FACTS.map((fact) => (
							<li
								key={fact.labelKey}
								className="flex justify-between gap-[18px] border-(--sp-line) border-b px-0.5 py-[15px] text-[0.92rem]"
							>
								<b className="font-bold tracking-[0.05em]">
									{t(fact.labelKey)}
								</b>
								<span className="text-end text-(--sp-ink-78)">
									{t(fact.valueKey)}
								</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
