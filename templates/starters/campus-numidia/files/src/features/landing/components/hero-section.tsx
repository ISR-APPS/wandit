// The first screen: the intake notice, the headline, two actions, the stat rail, the day vignette, and the campus photo.
// LandingPage renders it. Under 900px it becomes one column, and the vignette moves above the stat rail,
// so the timetable stays in the first phone screen.
import { useT } from "~/shared/i18n";
import {
	BUTTON,
	CAPTION_FILLED,
	CAPTION_LINE,
	LEDE,
	WRAP,
} from "../lib/type-styles";
import { ArrowGlyph } from "./arrow-glyph";
import { DayVignette } from "./day-vignette";

/** Bottom-aligned split at 1.04fr / 0.96fr. The right column bleeds to the screen edge. */
export function HeroSection() {
	const { t } = useT();
	const stats = [
		{ value: t("hero.stat1Value"), label: t("hero.stat1Label") },
		{ value: t("hero.stat2Value"), label: t("hero.stat2Label") },
		{ value: t("hero.stat3Value"), label: t("hero.stat3Label") },
	];
	return (
		<section
			aria-labelledby="hero-title"
			className="pt-[clamp(24px,3.2vw,44px)] pb-[clamp(26px,3vw,44px)]"
		>
			<div
				className={`${WRAP} grid grid-cols-1 gap-4 min-[900px]:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] min-[900px]:grid-rows-[auto_1fr] min-[900px]:items-end min-[900px]:gap-x-[clamp(26px,3.6vw,56px)] min-[900px]:gap-y-3.5`}
			>
				{/* Under 900px this wrapper dissolves, so its children can take their own order. */}
				<div className="contents min-[900px]:col-start-1 min-[900px]:row-span-2 min-[900px]:row-start-1 min-[900px]:block">
					<p
						data-pop=""
						className="cn-r order-1 inline-flex max-w-full flex-col gap-1 justify-self-start bg-(--cn-sand) px-3.5 pt-2.5 pb-[11px]"
					>
						<b className="font-display font-semibold text-[0.9375rem] leading-[1.15] tracking-[-0.012em]">
							{t("hero.noticeTitle")}
						</b>
						<span className="font-semibold text-[0.625rem] uppercase leading-[1.2] tracking-[0.11em] opacity-75">
							{t("hero.noticeDetail")}
						</span>
					</p>
					<h1
						id="hero-title"
						data-pop=""
						className="order-2 max-w-[17ch] text-balance font-bold font-display text-[clamp(2.35rem,5.5vw,4.35rem)] leading-[1.04] tracking-[-0.022em] min-[900px]:mt-3.5 min-[900px]:mb-[18px]"
					>
						{t("hero.titleStart")}
						<span className="text-primary">{t("hero.titleAccent")}</span>
						{t("hero.titleEnd")}
					</h1>
					<p data-pop="" className={`${LEDE} order-3`}>
						{t("hero.lede")}
					</p>
					<div
						data-pop=""
						className="order-4 mt-1 flex flex-wrap items-center gap-x-[22px] gap-y-3 min-[900px]:mt-[22px]"
					>
						<a href="#enrol" className={`${BUTTON} cn-btn`}>
							{t("hero.cta")}
							<ArrowGlyph />
						</a>
						<a
							href="#campus"
							className="cn-link inline-flex min-h-11 items-center font-semibold text-[0.9375rem]"
						>
							<span>{t("hero.visitLink")}</span>
						</a>
					</div>
					<ul
						aria-label={t("hero.statsLabel")}
						className="order-6 mt-0.5 grid grid-cols-3 border-foreground border-t-2 min-[900px]:mt-[clamp(26px,3vw,38px)]"
					>
						{stats.map((stat) => (
							<li
								key={stat.label}
								data-pop=""
								className="min-w-0 pe-3.5 pt-[13px] [&+li]:border-border [&+li]:border-s [&+li]:ps-[clamp(12px,1.6vw,22px)]"
							>
								<b className="block font-bold font-display text-[clamp(1.5rem,2.5vw,2.15rem)] tabular-nums leading-none tracking-[-0.03em]">
									{stat.value}
								</b>
								<span className="mt-2 block text-(--cn-ink-2) text-[0.8125rem] leading-[1.4]">
									{stat.label}
								</span>
							</li>
						))}
					</ul>
				</div>
				<div
					data-pop=""
					className="order-5 min-w-0 min-[900px]:col-start-2 min-[900px]:row-start-1"
				>
					<DayVignette />
				</div>
				<figure
					data-pop=""
					className="order-7 flex min-w-0 flex-col self-stretch min-[900px]:col-start-2 min-[900px]:row-start-2"
				>
					<div className="cn-r cn-bleed h-[250px] overflow-hidden bg-(--cn-pale-2) min-[900px]:h-auto min-[900px]:min-h-[290px] min-[900px]:flex-1">
						<img
							src="/images/campus.webp"
							alt={t("hero.photoAlt")}
							width={1600}
							height={900}
							fetchPriority="high"
							className="cn-photo size-full object-cover object-[50%_62%]"
						/>
					</div>
					<figcaption className="mt-3 flex flex-wrap gap-2">
						<span className={CAPTION_FILLED}>{t("hero.photoCaption1")}</span>
						<span className={CAPTION_LINE}>{t("hero.photoCaption2")}</span>
					</figcaption>
				</figure>
			</div>
		</section>
	);
}
