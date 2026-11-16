// The design chapter: a sticky arch photo of the orb and stem, beside three ledger rows N° 01 to N° 03.
// LandingPage renders it after the ticker. The "Design" link of the header jumps here.
import { useT } from "~/shared/i18n";
import { CHAPTER, FIG_CAPTION, WRAP } from "../lib/type-styles";
import { SectionHead } from "./section-head";

/** Grid .92fr / 1.08fr: the photo column is the narrow one, because it stays while the rows pass. */
export function DesignSection() {
	const { t } = useT();
	const features = [
		{ title: t("design.feature1Title"), body: t("design.feature1Body") },
		{ title: t("design.feature2Title"), body: t("design.feature2Body") },
		{ title: t("design.feature3Title"), body: t("design.feature3Body") },
	];
	return (
		<section
			id="design"
			aria-labelledby="design-title"
			className={`${CHAPTER} scroll-mt-[4.5rem]`}
		>
			<div className={WRAP}>
				<SectionHead
					kicker={t("design.kicker")}
					title={t("design.title")}
					turn={t("design.titleTurn")}
					titleId="design-title"
					className="mb-[clamp(2.6rem,6vw,4.5rem)]"
				/>
				<div className="grid items-start gap-[clamp(2.5rem,6vw,6rem)] lg:grid-cols-[0.92fr_1.08fr]">
					<figure data-reveal className="lg:sticky lg:top-[6.5rem]">
						<div className="lume-wipe lume-arch lume-arch-story aspect-[4/3] lg:aspect-[1/1.08]">
							<img
								src="/images/lamp-detail.webp"
								width={1200}
								height={1200}
								alt={t("design.imageAlt")}
								loading="lazy"
								className="size-full object-cover"
							/>
						</div>
						<figcaption className={`${FIG_CAPTION} text-foreground/52`}>
							<span>{t("design.caption")}</span>
							<b className="font-medium text-(--lume-brass-deep)">
								{t("design.figure")}
							</b>
						</figcaption>
					</figure>
					<div>
						{features.map((feature, index) => (
							<article
								key={feature.title}
								data-reveal
								className="grid grid-cols-[3.4rem_minmax(0,1fr)] gap-x-[clamp(1.2rem,3vw,2.4rem)] gap-y-[1.4rem] border-foreground/16 border-t py-[clamp(1.8rem,3.5vw,2.6rem)] last:border-b"
							>
								<p className="pt-[0.45rem] font-display font-medium text-(--lume-brass-deep) text-[0.95rem] tabular-nums tracking-[0.1em]">
									{`${t("site.numberSign")} ${String(index + 1).padStart(2, "0")}`}
								</p>
								<div>
									<h3 className="mb-[0.7rem] font-display font-medium text-[clamp(1.45rem,2.4vw,2rem)] leading-[1.15] tracking-[-0.005em]">
										{feature.title}
									</h3>
									<p className="max-w-[34em] text-foreground/72">
										{feature.body}
									</p>
								</div>
							</article>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
