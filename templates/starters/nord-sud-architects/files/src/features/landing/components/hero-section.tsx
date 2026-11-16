// PL·01, the title sheet: a meta strip between two ink rules, then the statement facing the south elevation.
// LandingPage renders it first. The statement column carries a dimension line that measures its own width.
// The elevation plots once at load in CSS; with less motion it shows complete at once.
import { useT } from "~/shared/i18n";
import { useCurrentMonth } from "../hooks/use-current-month";
import { CONTACT_HREF } from "../lib/content";
import { BODY, BUTTON_GHOST, BUTTON_PRIMARY, LABEL } from "../lib/styles";
import { MeasuredCote } from "./measured-cote";
import { SouthElevation } from "./south-elevation";

// The width of the title column at 1440px: 7/12 of the 1240px wrap after the 72px gap.
// The server render prints it until the browser measures.
const TITLE_COLUMN_PX = 681;

/** The first screen: a 7/5 split from 1024px, one column on a phone with the figure under the actions. */
export function HeroSection() {
	const { t } = useT();
	const month = useCurrentMonth();
	return (
		<section
			aria-labelledby="hero-title"
			className="pt-[clamp(1.75rem,4.5vh,3rem)] pb-[clamp(4rem,9vh,6.5rem)]"
		>
			<div className="ns-wrap">
				<p
					className={`${LABEL} flex justify-between gap-6 border-foreground border-y-[1.5px] py-2.5 font-normal text-[0.625rem] text-foreground/80`}
				>
					<span className="whitespace-nowrap">{t("hero.sheetNumber")}</span>
					<span className="hidden whitespace-nowrap lg:inline">
						{t("hero.firm")}
					</span>
					<span className="whitespace-nowrap">{t("hero.scale")}</span>
					<span className="hidden whitespace-nowrap md:inline">
						{t("hero.format")}
					</span>
					<span className="whitespace-nowrap">{t("hero.place")}</span>
					{/* The month of the visit: empty in the prerendered page, filled in by the browser. */}
					<span className="hidden min-w-[7ch] whitespace-nowrap text-end md:inline">
						{month}
					</span>
				</p>
				<div className="grid items-center gap-12 pt-[clamp(2.5rem,6vh,4.5rem)] lg:grid-cols-[7fr_5fr] lg:gap-[clamp(2rem,5vw,4.5rem)]">
					<div>
						<h1
							id="hero-title"
							className="ns-title max-w-[14ch] text-[clamp(2.6rem,6vw,5rem)] leading-[1.02] tracking-[-0.03em]"
						>
							{t("hero.title")}
						</h1>
						<p
							className={`${BODY} mt-6 max-w-[52ch] text-[1.0625rem] leading-[1.65]`}
						>
							{t("hero.body")}
						</p>
						<div className="mt-8 flex flex-wrap gap-4">
							<a href={CONTACT_HREF} className={BUTTON_PRIMARY}>
								{t("hero.ctaPrimary")}
							</a>
							<a href="#sheets" className={BUTTON_GHOST}>
								{t("hero.ctaSecondary")}
							</a>
						</div>
						<MeasuredCote
							label="hero.coteLabel"
							fallbackWidth={TITLE_COLUMN_PX}
							className="mt-10"
						/>
					</div>
					<figure className="ns-figure ns-plot-on-load">
						<SouthElevation />
						<figcaption
							className={`${LABEL} mt-2.5 font-normal text-[0.625rem] text-foreground/70`}
						>
							{t("hero.figureCaption")}
						</figcaption>
					</figure>
				</div>
			</div>
		</section>
	);
}
