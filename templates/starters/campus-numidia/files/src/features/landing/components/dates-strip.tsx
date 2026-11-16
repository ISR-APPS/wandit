// The sand strip under the hero: four key dates of the intake, each a caps label and a bold date.
// LandingPage renders it right after HeroSection, so the first screen ends on a color block and a commitment.
import { useT } from "~/shared/i18n";
import { WRAP } from "../lib/type-styles";

/** Full-bleed sand band. The four facts wrap onto two rows on a phone. */
export function DatesStrip() {
	const { t } = useT();
	const dates = [
		{ label: t("dates.openDaysLabel"), value: t("dates.openDaysValue") },
		{ label: t("dates.closeLabel"), value: t("dates.closeValue") },
		{ label: t("dates.interviewsLabel"), value: t("dates.interviewsValue") },
		{ label: t("dates.startLabel"), value: t("dates.startValue") },
	];
	return (
		<section aria-label={t("dates.label")} className="bg-(--cn-sand)">
			<dl
				data-stagger=""
				className={`${WRAP} grid grid-cols-1 gap-x-[clamp(16px,3vw,44px)] gap-y-3 py-[17px] min-[1100px]:flex min-[560px]:grid-cols-2 min-[1100px]:flex-wrap min-[1100px]:justify-between`}
			>
				{dates.map((date) => (
					<div
						key={date.label}
						data-pop=""
						className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1"
					>
						<dt className="font-semibold text-(--cn-sand-ink) text-[0.625rem] uppercase leading-none tracking-[0.15em]">
							{date.label}
						</dt>
						<dd className="font-bold font-display text-[0.9375rem] tracking-[-0.01em]">
							{date.value}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
