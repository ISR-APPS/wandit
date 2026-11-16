// The first screen, "the window": a sky zone and a land zone split by the sun rule at 22% of the hero height.
// LandingPage renders it. The type lives under the rule; the dune photo bleeds off the end edge with its crest on the same line.
// On a phone: type, then a photo band that draws its own rule at 30%, then the fact rows. landing.css (.hz-hero) holds the grid.
import { useT } from "~/shared/i18n";
import { PHOTOS } from "../lib/photos";
import { CAPTION, H1, LEAD, META_SMALL } from "../lib/type-styles";
import { LockedPhoto } from "./locked-photo";
import { TextLink } from "./text-link";
import { TicketLink } from "./ticket-link";

/** The hero. It states the place, the promise, and three numbers. */
export function HeroSection() {
	const { t } = useT();
	const titleLines = [
		t("hero.titleLine1"),
		t("hero.titleLine2"),
		t("hero.titleLine3"),
	];
	const facts = [t("hero.fact1"), t("hero.fact2"), t("hero.fact3")];
	return (
		<section aria-labelledby="hero-title" className="hz-hero">
			<div className="hz-hero-grid">
				<div className="hz-hero-type">
					<div className="hz-hero-sky hz-enter">
						<p className={META_SMALL}>{t("hero.eyebrow")}</p>
						<p className={`${META_SMALL} tabular-nums`}>
							{t("hero.coordinates")}
						</p>
					</div>
					<div className="hz-hero-rule" aria-hidden="true">
						<span className="hz-hero-rule-label font-semibold text-(--hz-ink-soft) text-[10px] uppercase leading-[1.5] tracking-[0.2em]">
							{t("hero.ruleLabel")}
						</span>
					</div>
					<h1 id="hero-title" className={`${H1} mb-[clamp(22px,2.4vw,26px)]`}>
						{titleLines.map((line, index) => (
							<span key={line} className="hz-line-mask">
								{/* The title lines rise after the rule draws (180 ms + 160 ms), 75 ms apart. */}
								<span
									className="hz-line-rise"
									style={{ animationDelay: `${340 + index * 75}ms` }}
								>
									{line}
								</span>
							</span>
						))}
					</h1>
					<p className={`${LEAD} hz-enter [--hz-delay:720ms]`}>
						{t("hero.lead")}
					</p>
					<div className="hz-enter mt-[clamp(28px,3vw,34px)] flex flex-wrap items-center gap-x-[26px] gap-y-3 [--hz-delay:810ms]">
						<TicketLink href="#quote" code={t("site.ticketCode")}>
							{t("hero.cta")}
						</TicketLink>
						<TextLink href="#circuits">{t("hero.secondary")}</TextLink>
					</div>
				</div>
				<figure className="hz-hero-photo">
					<LockedPhoto
						photo={PHOTOS.dunes}
						lock={{ k: 1.15, ty: -3.6 }}
						phoneLock={{ k: 1.5, ty: -2.73 }}
						alt={t("hero.photoAlt")}
						className="hz-hero-frame hz-wipe-now"
						rule="phone"
						ruleAt={0.3}
						eager
					/>
					<figcaption className={`${CAPTION} hz-hero-caption`}>
						{t("hero.photoCaption")}
					</figcaption>
				</figure>
				<ul className="hz-hero-facts hz-enter [--hz-delay:900ms]">
					{facts.map((fact) => (
						<li key={fact} className={META_SMALL}>
							{fact}
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
