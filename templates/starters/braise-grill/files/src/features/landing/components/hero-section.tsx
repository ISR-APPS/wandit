// The first screen: a hard seam between the text panel and the fire photo, with the tonight slate across it.
// LandingPage renders it first. It reads TONIGHT_SITTINGS of lib/content.ts. landing.css (.br-hero) holds the seam grid and the phone order:
// text, then photo, then slate, so the fire lands inside the first screen on a phone.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { TONIGHT_SITTINGS } from "../lib/content";
import {
	BUTTON,
	BUTTON_EMBER,
	BUTTON_GHOST,
	FIGURE,
	MICRO_LABEL,
} from "../lib/type-styles";
import { EmberDot } from "./ember-dot";
import { Eyebrow } from "./eyebrow";

/** The hero. The photo is architecture, not a plate, so it has no frame and no caption. */
export function HeroSection() {
	const { t } = useT();

	return (
		<section aria-labelledby="hero-title" className="br-hero bg-background">
			<div className="br-hero__col">
				<div className="br-hero__text">
					<Eyebrow className="mb-[clamp(14px,1.6vw,22px)]">
						{t("hero.eyebrow")}
					</Eyebrow>
					<h1
						id="hero-title"
						className="mb-[clamp(20px,2.4vw,30px)] font-bold font-display text-[clamp(2.9rem,6.4vw,5.6rem)] leading-[0.96] tracking-[-0.035em]"
					>
						<span className="br-fire">
							{t("hero.titleFire")}
							<i aria-hidden="true" className="br-fire__u" />
						</span>{" "}
						{t("hero.titleRest")}
					</h1>
					<p className="max-w-[38ch] text-[clamp(16px,1.24vw,19.5px)] text-foreground/72 leading-[1.58]">
						{t("hero.lead")}
					</p>
					<div className="mt-[clamp(26px,3.4vw,38px)] flex flex-wrap gap-3">
						<span className="relative inline-flex">
							<span aria-hidden="true" className="br-halo br-halo--late" />
							<a
								href="#book"
								className={cn(BUTTON, BUTTON_EMBER, "relative z-[1]")}
							>
								{t("hero.ctaBook")}
							</a>
						</span>
						<a href="#menu" className={cn(BUTTON, BUTTON_GHOST)}>
							{t("hero.ctaMenu")}
						</a>
					</div>
				</div>

				<div className="br-slate br-hero__tonight">
					<div aria-hidden="true" className="br-slate__heat" />
					<dl className="relative z-[2] flex flex-wrap items-start gap-[clamp(16px,2vw,28px)]">
						<div className="br-tonight__cell">
							<dt className={cn(MICRO_LABEL, "flex items-center gap-2.5")}>
								<EmberDot isLate />
								{t("hero.tonightLabel")}
							</dt>
							<dd
								className={cn(
									FIGURE,
									"mt-1.5 font-semibold text-[clamp(1.05rem,1.5vw,1.35rem)] tracking-[-0.015em]",
								)}
							>
								{t("hero.tonightValue")}
							</dd>
						</div>
						{TONIGHT_SITTINGS.map((cell) => (
							<div key={cell.labelKey} className="br-tonight__cell">
								<dt className={MICRO_LABEL}>{t(cell.labelKey)}</dt>
								<dd
									className={cn(
										FIGURE,
										"mt-1.5 font-semibold text-[clamp(1.05rem,1.5vw,1.35rem)] tracking-[-0.015em]",
									)}
								>
									{t(cell.valueKey)}
								</dd>
							</div>
						))}
					</dl>
				</div>
			</div>

			<div className="br-hero__media">
				<img
					src="/images/grill-skewers.webp"
					width={1600}
					height={900}
					alt={t("hero.photoAlt")}
					fetchPriority="high"
					className="br-photo"
				/>
				<div aria-hidden="true" className="br-hero__seam" />
			</div>
		</section>
	);
}
