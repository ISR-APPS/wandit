// PL·06, the studio survey: one claim beside four figures, each under a dimension bracket.
// LandingPage renders it after the method. It reads STUDIO_FIGURES of lib/content.ts.
// Each bracket bar draws across when it scrolls into view, like the head rules of the sections.
import { useT } from "~/shared/i18n";
import { STUDIO_FIGURES } from "../lib/content";
import { BODY, LABEL, SECTION } from "../lib/styles";

/** A 5/7 split from 1024px: the claim on the start side, a 2 x 2 grid of figures on the end side at every width. */
export function FiguresSection() {
	const { t } = useT();
	return (
		<section aria-labelledby="figures-title" className={`${SECTION} ns-paper`}>
			<div className="ns-wrap grid items-center gap-12 lg:grid-cols-[5fr_7fr] lg:gap-[clamp(2.5rem,6vw,5.5rem)]">
				<div data-reveal className="ns-rise">
					<span className={`${LABEL} text-foreground/70`}>
						{t("figures.kicker")}
					</span>
					<h2
						id="figures-title"
						className="ns-title mt-4 max-w-[16ch] text-balance text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.05]"
					>
						{t("figures.title")}
					</h2>
					<p className={`${BODY} mt-5 max-w-[44ch] leading-[1.65]`}>
						{t("figures.body")}
					</p>
				</div>
				{/* Two columns even on a phone: four large numerals in one column leave too much empty paper. */}
				<ul className="grid grid-cols-2 gap-x-6 gap-y-9 sm:gap-x-10 sm:gap-y-11">
					{STUDIO_FIGURES.map((figure) => (
						<li key={figure.label}>
							{/* The bracket: a bar with a tick at each end and its qualifier cut into the middle. */}
							<div aria-hidden="true" className="relative mb-3.5 h-4">
								<span
									data-reveal
									className="ns-rule absolute inset-x-0 top-[7px] h-[1.5px] bg-foreground"
								/>
								<span className="absolute start-0 top-[7px] h-[9px] w-[1.5px] bg-foreground" />
								<span className="absolute end-0 top-[7px] h-[9px] w-[1.5px] bg-foreground" />
								<span
									className={`${LABEL} absolute start-1/2 top-0 -translate-x-1/2 whitespace-nowrap bg-background px-2 font-normal text-[0.5625rem] text-foreground/70 rtl:translate-x-1/2`}
								>
									{t(figure.bracket)}
								</span>
							</div>
							<p className="ns-title text-[clamp(2.6rem,4.2vw,3.7rem)] tabular-nums leading-none">
								{figure.value}
							</p>
							<p className={`${LABEL} mt-2 font-normal text-foreground/70`}>
								{t(figure.label)}
							</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
