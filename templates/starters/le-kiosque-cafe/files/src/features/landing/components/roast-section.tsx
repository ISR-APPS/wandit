// Page 2 of the paper, "The roast & the method": a narrow rail of four briefs against a wide feature story.
// LandingPage renders it after the front page. The feature has the cup plate and two justified ruled columns.
// Each block rises when the section scrolls into view (use-press-roll.ts and kiosque.css).
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BRIEFS } from "../lib/content";
import { BYLINE, DATELINE, DECK, HEADLINE, JUMP } from "../lib/type-styles";
import { CupPlate } from "./cup-plate";
import { PressPlate } from "./press-plate";
import { SectionHead } from "./section-head";
import { Slug } from "./slug";

/** The briefs rail and the feature. Under 980px the rail sits above the feature. */
export function RoastSection() {
	const { t } = useT();
	return (
		<section
			id="roast"
			aria-labelledby="roast-title"
			data-roll-group
			className="ks-wrap ks-section"
		>
			<SectionHead
				titleId="roast-title"
				pageKey="roast.page"
				titleKey="roast.title"
				noteKey="roast.note"
			/>
			<div className="grid gap-[clamp(1.8rem,3.5vw,3.2rem)] min-[980px]:grid-cols-[0.62fr_1.38fr]">
				<aside
					aria-label={t("roast.briefsLabel")}
					className="border-(--ks-rule) border-b pb-6 min-[980px]:border-e min-[980px]:border-b-0 min-[980px]:pe-[clamp(1.4rem,2.5vw,2.4rem)] min-[980px]:pb-0"
				>
					{BRIEFS.map((brief, index) => (
						<div
							key={brief.titleKey}
							data-roll
							className={cn(
								"ks-roll border-(--ks-rule) border-b py-4",
								index === 0 && "pt-0.5",
								index === BRIEFS.length - 1 && "border-b-0 pb-0",
							)}
						>
							<Slug>{t(brief.slugKey)}</Slug>
							<h3 className="mt-1.5 font-display font-extrabold text-[1.25rem] leading-tight">
								{t(brief.titleKey)}
							</h3>
							<p className="mt-1.5 text-[0.95rem] leading-[1.55]">
								{t(brief.bodyKey)}
							</p>
						</div>
					))}
				</aside>
				<article>
					<div data-roll className="ks-roll">
						<Slug>{t("roast.slug")}</Slug>
						<h3
							// tailwind-merge drops the leading of HEADLINE with a new size, so the leading comes again.
							className={cn(
								HEADLINE,
								"mt-2 text-[clamp(1.7rem,3.6vw,2.9rem)] leading-[1.04]",
							)}
						>
							{t("roast.headline")}
						</h3>
						<p className={cn(DECK, "mt-3")}>{t("roast.deck")}</p>
						<p className={cn(BYLINE, "mt-4")}>{t("roast.byline")}</p>
					</div>
					<div className="mt-7 grid items-start gap-[clamp(1.6rem,3vw,2.6rem)] min-[640px]:grid-cols-[0.85fr_1.15fr]">
						<div data-roll className="ks-roll">
							<PressPlate captionKey="roast.caption">
								<CupPlate />
							</PressPlate>
						</div>
						<div data-roll className="ks-roll ks-cols ks-cols-narrow">
							<p>
								<span className={DATELINE}>{t("roast.dateline")}</span>{" "}
								{t("roast.body1")}
							</p>
							<p>{t("roast.body2")}</p>
						</div>
					</div>
					<p data-roll className="ks-roll mt-2 text-end">
						<a href="#menu" className={JUMP}>
							{t("roast.jump")}
						</a>
					</p>
				</article>
			</div>
		</section>
	);
}
