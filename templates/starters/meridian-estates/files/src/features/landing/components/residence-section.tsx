// The flagship residence, Casa Meridiana: a running head, a full-bleed interior photo with parallax,
// the founder's quote pulled up onto the photo as an overlapping plate, a ruled spec table, and a ruled link.
// LandingPage renders it after the portfolio. It reads CASA_MERIDIANA and moves the photo with useParallax.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useParallax } from "../hooks/use-parallax";
import { CASA_MERIDIANA } from "../lib/content";
import { formatWhole } from "../lib/format";
import { staggerStep } from "../lib/motion";
import { AccentWords } from "./accent-words";
import { RunningHead } from "./running-head";

/** The section with id "residence". The link leads to the viewing note. */
export function ResidenceSection() {
	const { t, locale } = useT();
	const photoRef = useRef<HTMLDivElement>(null);
	useParallax(photoRef);
	// The same number formats as PropertyPanel: a year has no group separator.
	const facts = [
		{ value: String(CASA_MERIDIANA.bedrooms), label: t("portfolio.bedrooms") },
		{
			value: String(CASA_MERIDIANA.bathrooms),
			label: t("residence.bathrooms"),
		},
		{
			value: `${formatWhole(CASA_MERIDIANA.interiorM2, locale)} m²`,
			label: t("portfolio.interior"),
		},
		{
			value: String(CASA_MERIDIANA.completedYear),
			label: t("portfolio.completed"),
		},
	];
	return (
		<section
			id="residence"
			aria-labelledby="residence-title"
			className="scroll-mt-16 pt-[clamp(6rem,14vh,11rem)]"
		>
			<div className="mer-wrap mb-[clamp(3rem,8vh,6rem)]">
				<RunningHead
					index={t("residence.index")}
					label={t("residence.label")}
					titleId="residence-title"
					aside={t("residence.aside")}
				/>
			</div>

			<div
				ref={photoRef}
				className="mer-residence-photo relative h-[min(88vh,58vw)] min-h-[26rem] overflow-hidden"
			>
				<img
					src="/images/residence-interior.webp"
					alt={t("residence.imageAlt")}
					width={1600}
					height={1074}
					loading="lazy"
					decoding="async"
				/>
			</div>

			<figure
				data-reveal
				className="mer-rise relative z-[3] mx-[var(--mer-gutter)] -mt-[clamp(3rem,10vh,7rem)] border border-foreground/8 bg-card px-[clamp(1.6rem,4.5vw,4rem)] pt-[clamp(2.6rem,5vw,3.8rem)] pb-[clamp(2.2rem,5vw,3.8rem)] md:mx-auto md:max-w-3xl"
			>
				<span
					aria-hidden="true"
					className="mer-outline pointer-events-none absolute start-[clamp(0.6rem,2vw,1.6rem)] -top-[0.3em] select-none font-display text-[clamp(5rem,10vw,8.5rem)] italic leading-none"
				>
					“
				</span>
				<blockquote className="font-display text-[clamp(1.45rem,2.8vw,2.35rem)] leading-[1.38] tracking-[-0.005em]">
					<p>
						<AccentWords
							start={t("residence.quoteStart")}
							accent={t("residence.quoteAccent")}
						/>
					</p>
				</blockquote>
				<figcaption className="mt-7 flex items-center justify-end gap-4 text-[0.6875rem] text-foreground/60 uppercase tracking-[0.2em]">
					<span aria-hidden="true" className="h-px w-9 bg-primary/55" />
					{t("residence.quoteAuthor")}
				</figcaption>
			</figure>

			<dl className="mx-[var(--mer-gutter)] mt-[clamp(3rem,8vh,5rem)] grid grid-cols-2 gap-px border-foreground/14 border-y bg-foreground/8 md:mx-auto md:max-w-5xl md:grid-cols-4">
				{facts.map((fact, position) => (
					<div
						key={fact.label}
						data-reveal
						className={`mer-rise flex flex-col-reverse gap-2 bg-background px-4 py-7 text-center ${staggerStep(position)}`}
					>
						<dt className="text-[0.65625rem] text-foreground/55 uppercase tracking-[0.2em]">
							{fact.label}
						</dt>
						<dd className="font-display text-[clamp(1.5rem,2.4vw,2.2rem)] tabular-nums">
							{fact.value}
						</dd>
					</div>
				))}
			</dl>

			<div className="mt-[clamp(2.5rem,6vh,4rem)] flex justify-center px-5">
				<a
					href="#contact"
					className="mer-line-link inline-flex min-h-11 items-center gap-3.5 border-primary/55 border-b pb-2 text-[0.71875rem] text-foreground uppercase tracking-[0.2em] hover:border-primary hover:text-primary"
				>
					{t("residence.cta")}
					<span
						aria-hidden="true"
						className="inline-block font-display text-[1rem] normal-case italic tracking-normal rtl:rotate-180"
					>
						→
					</span>
				</a>
			</div>
		</section>
	);
}
