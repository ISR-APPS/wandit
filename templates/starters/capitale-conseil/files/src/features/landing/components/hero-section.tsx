// The hero of the home page: the claim on a hard left axis, and one duotone plate that reaches the end edge.
// LandingPage renders it first. It closes with a hairline row of three facts of the firm.
// The section has no reveal: it is the first screen, and it must be complete in the server page.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CONTACT_HREF, MINI_FIGURES } from "../lib/content";
import { BUTTON_GHOST, BUTTON_PRIMARY, MICRO, SOFT } from "../lib/type-styles";
import { DuotonePlate } from "./duotone-plate";
import { SectionLabel } from "./section-label";

/** The statement hero. Its one h1 is the only h1 of the page. */
export function HeroSection() {
	const { t } = useT();
	return (
		<section
			id="top"
			className="cap-hero grid grid-cols-1 gap-[clamp(2.2rem,4vw,3.4rem)] pt-[clamp(2.6rem,6vh,4.5rem)] pb-[clamp(3rem,7vh,5rem)] min-[56.25rem]:grid-cols-[minmax(0,1fr)_minmax(0,40%)] min-[56.25rem]:items-start min-[56.25rem]:pb-[clamp(3.5rem,8vh,6rem)]"
		>
			<div>
				<SectionLabel className="mb-[1.4rem]">{t("hero.label")}</SectionLabel>
				<h1 className="mb-[1.6rem] max-w-[18ch] text-balance font-display font-normal text-[clamp(2.6rem,6.2vw,5.4rem)] leading-[1.04] tracking-[-0.015em]">
					{t("hero.title")}
				</h1>
				<p
					className={cn(
						SOFT,
						"max-w-[56ch] text-[clamp(1.15rem,1.7vw,1.45rem)] leading-normal",
					)}
				>
					{t("hero.lead")}
				</p>
				<div className="mt-[2.2rem] grid gap-3.5 min-[35rem]:flex min-[35rem]:flex-wrap">
					<a href={CONTACT_HREF} className={BUTTON_PRIMARY}>
						{t("hero.ctaMeeting")}
					</a>
					<a href="#references" className={BUTTON_GHOST}>
						{t("hero.ctaMandate")}
					</a>
				</div>
				<ul className="mt-[clamp(2.4rem,5vh,3.4rem)] grid grid-cols-3 gap-4 border-foreground/12 border-t pt-6">
					{MINI_FIGURES.map((figure, index) => (
						<li
							key={figure.label}
							className={cn(
								"flex flex-col gap-1.5 pe-2.5",
								index > 0 &&
									"border-foreground/12 border-s ps-[clamp(0.7rem,2vw,1.4rem)]",
							)}
						>
							<span className="font-display text-[clamp(1.45rem,3.4vw,2.5rem)] leading-[1.06] tracking-[-0.02em]">
								{t(figure.value)}
								{/* The unit is its own small span, so it wraps as one word on a phone. */}
								<span className="ms-[0.28em] whitespace-nowrap text-[0.46em] text-primary tracking-normal">
									{t(figure.unit)}
								</span>
							</span>
							<span className={cn(MICRO, SOFT)}>{t(figure.label)}</span>
						</li>
					))}
				</ul>
			</div>
			<DuotonePlate
				src="/images/lobby-dusk.webp"
				alt={t("hero.plateAlt")}
				width={1200}
				height={1600}
				isLazy={false}
				frameClassName="aspect-[4/5] min-[56.25rem]:aspect-auto min-[56.25rem]:h-[clamp(460px,66vh,660px)]"
				captionLine={t("hero.plateLine")}
				captionNote={t("hero.plateNote")}
				captionClassName="min-[56.25rem]:pe-(--cap-gutter)"
			/>
		</section>
	);
}
