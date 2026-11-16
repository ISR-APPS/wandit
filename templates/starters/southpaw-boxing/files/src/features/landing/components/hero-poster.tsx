// The first screen: a framed fight poster with the club name, the two actions, the boxer, and the bill columns.
// landing-page.tsx renders it. landing.css lands the letters and the ding ring with CSS only.
import { useT } from "~/shared/i18n";
import { BillColumn } from "./bill-column";
import { BoxerFigure } from "./boxer-figure";
import { Burst } from "./burst";
import { PunchLine } from "./punch-line";
import { Star } from "./star";
import { Ticker } from "./ticker";

/** The hero of the page. Its two buttons lead to the booking ticket and to the fight card. */
export function HeroPoster() {
	const { t } = useT();
	const wordmark = `${t("hero.lineThe")} ${t("hero.lineName")} ${t("hero.lineSub")}`;

	return (
		<section
			aria-label={t("hero.sectionLabel")}
			className="sp-gutter pt-[clamp(1.1rem,2vw,1.6rem)]"
		>
			<div className="sp-poster sp-frame sp-halftone mx-auto max-w-7xl overflow-clip px-[clamp(1rem,4vw,4rem)] pt-[clamp(3.25rem,4vw,3.5rem)] text-center">
				<Burst className="sp-gold pointer-events-none absolute start-2 top-2 size-11 opacity-40 lg:start-4 lg:top-4 lg:size-22 lg:opacity-55" />
				<Burst className="sp-gold pointer-events-none absolute end-2 top-2 size-11 opacity-40 lg:end-4 lg:top-4 lg:size-22 lg:opacity-55" />
				<div
					aria-hidden="true"
					className="sp-ding pointer-events-none absolute start-1/2 top-[36%] aspect-square w-[min(58vw,540px)]"
				/>

				<p className="sp-rise sp-line inline-block border-y px-3 py-2.5 font-bold text-[0.62rem] text-muted-foreground uppercase leading-relaxed tracking-[0.24em] sm:px-5 sm:text-[0.72rem] sm:tracking-[0.34em]">
					{t("hero.eyebrowPlace")}
					<Star className="sp-sep text-primary" />
					{t("hero.eyebrowEst")}
					<Star className="sp-sep hidden text-primary sm:inline-block" />
					<span className="block sm:inline">{t("hero.eyebrowStreet")}</span>
				</p>

				<h1
					aria-label={wordmark}
					className="relative mt-[clamp(1.4rem,2.2vw,1.9rem)] font-display uppercase"
				>
					<PunchLine
						text={t("hero.lineThe")}
						startMs={150}
						stepMs={40}
						className="indent-[0.6em] font-extrabold text-[clamp(1.4rem,3.2vw,2.5rem)] text-muted-foreground leading-none tracking-[0.6em] sm:indent-[0.85em] sm:tracking-[0.85em]"
					/>
					<PunchLine
						text={t("hero.lineName")}
						startMs={300}
						stepMs={55}
						className="sp-hero-name font-extrabold text-[clamp(4rem,17.5vw,14rem)] leading-[0.86] tracking-[0.01em]"
					/>
					<PunchLine
						text={t("hero.lineSub")}
						startMs={720}
						stepMs={30}
						className="sp-hot mt-1 indent-[0.22em] font-extrabold text-[clamp(1.6rem,4.4vw,3.5rem)] leading-none tracking-[0.22em] sm:indent-[0.34em] sm:tracking-[0.34em]"
					/>
				</h1>

				<div
					className="sp-rise mx-auto mt-[clamp(1.1rem,1.8vw,1.5rem)] flex max-w-155 items-center justify-center gap-4"
					style={{ animationDelay: "1000ms" }}
				>
					<span className="sp-line-strong h-px min-w-6 flex-1 border-t" />
					<span className="sp-gold whitespace-nowrap font-bold text-[0.62rem] uppercase tracking-[0.2em] sm:text-[0.74rem] sm:tracking-[0.3em]">
						{t("hero.oneNight")}
					</span>
					<span className="sp-line-strong h-px min-w-6 flex-1 border-t" />
				</div>

				<p
					className="sp-rise mx-auto mt-5 max-w-[41rem] text-balance text-muted-foreground md:text-lg"
					style={{ animationDelay: "1090ms" }}
				>
					{t("hero.copy")}
				</p>

				<div
					className="sp-rise relative mt-[clamp(1.6rem,2.4vw,2rem)] flex flex-wrap justify-center gap-4"
					style={{ animationDelay: "1180ms" }}
				>
					<a
						href="#book"
						className="sp-btn sp-btn-primary inline-block px-7 pt-3.5 pb-3 font-display font-extrabold text-xl uppercase leading-tight tracking-[0.07em]"
					>
						{t("hero.ctaPrimary")}
					</a>
					<a
						href="#card"
						className="sp-btn sp-btn-ghost inline-block px-7 pt-3.5 pb-3 font-display font-extrabold text-xl uppercase leading-tight tracking-[0.07em]"
					>
						{t("hero.ctaSecondary")}
					</a>
				</div>

				<div
					className="sp-rise relative mx-auto mt-[clamp(1.4rem,2vw,1.6rem)] grid max-w-270 items-center gap-3 lg:grid-cols-[1fr_minmax(0,400px)_1fr] lg:items-start lg:gap-6 xl:gap-12"
					style={{ animationDelay: "1270ms" }}
				>
					<BillColumn
						kicker={t("hero.billKicker")}
						lines={[t("hero.bill1"), t("hero.bill2"), t("hero.bill3")]}
						outlinedIndex={1}
					/>
					<div className="mx-auto -mb-1 w-full max-w-75 lg:max-w-100">
						<BoxerFigure label={t("hero.boxerAlt")} />
					</div>
					<a
						href="#book"
						className="sp-admit mx-auto mt-1 mb-5 inline-block px-4 pt-2 pb-1.5 font-display font-extrabold text-lg uppercase leading-tight tracking-[0.1em] lg:hidden"
					>
						{t("hero.stamp")}
					</a>
					<BillColumn
						kicker={t("hero.recordKicker")}
						lines={[t("hero.record1"), t("hero.record2"), t("hero.record3")]}
						outlinedIndex={0}
						stamp={t("hero.stamp")}
					/>
				</div>

				<p className="sp-faint sp-line relative mt-3 border-t px-2 pt-3.5 pb-4 font-semibold text-[0.64rem] uppercase leading-loose tracking-[0.22em]">
					<span className="block lg:inline">{t("hero.fine1")}</span>
					<Star className="sp-sep hidden text-primary lg:inline-block" />
					<span className="block lg:inline">{t("hero.fine2")}</span>
					<Star className="sp-sep hidden text-primary lg:inline-block" />
					<span className="block lg:inline">{t("hero.fine3")}</span>
				</p>
			</div>

			<Ticker />
		</section>
	);
}
