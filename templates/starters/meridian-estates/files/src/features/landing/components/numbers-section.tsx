// "Meridian, measured": a tone-step band one shade lighter than the page, with a ruled head row
// and four figures in a ruled grid. LandingPage renders it after the residence.
// It reads STUDIO_FIGURES. The figure cells rise in one after the other.
import { useT } from "~/shared/i18n";
import { STUDIO_FIGURES } from "../lib/content";
import { formatWhole } from "../lib/format";
import { staggerStep } from "../lib/motion";

/** Four columns on a wide screen, two by two on a phone. Internal hairlines come from a 1px grid gap. */
export function NumbersSection() {
	const { t, locale } = useT();
	return (
		<section
			aria-label={t("numbers.label")}
			className="mt-[clamp(6rem,14vh,11rem)] border-foreground/8 border-y bg-card"
		>
			<div className="mer-gutter flex items-baseline justify-between gap-4 border-foreground/8 border-b py-6">
				<p className="text-[0.6875rem] text-foreground/60 uppercase tracking-[0.22em]">
					{t("numbers.label")}
				</p>
				<p className="text-[0.6875rem] text-foreground/55 uppercase tracking-[0.22em]">
					{t("numbers.years")}
				</p>
			</div>
			<dl className="grid grid-cols-2 gap-px bg-foreground/8 lg:grid-cols-4">
				{STUDIO_FIGURES.map((figure, position) => (
					<div
						key={figure.label}
						data-reveal
						className={`mer-rise flex flex-col-reverse justify-end gap-3 bg-card py-[clamp(3rem,7vh,5rem)] ps-[var(--mer-gutter)] pe-4 ${staggerStep(position)}`}
					>
						<dt className="max-w-[18ch] text-[0.6875rem] text-foreground/55 uppercase leading-[1.7] tracking-[0.2em]">
							{t(figure.label)}
						</dt>
						<dd className="whitespace-nowrap font-display text-[clamp(2.4rem,5vw,4.8rem)] tabular-nums leading-none tracking-[-0.02em]">
							{formatWhole(figure.value, locale)}
							{figure.suffix === "" ? null : (
								<sup className="ms-1 text-[0.45em] text-primary italic">
									{figure.suffix}
								</sup>
							)}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
