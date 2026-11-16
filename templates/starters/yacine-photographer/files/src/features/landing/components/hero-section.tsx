// The first screen: the claim in display type, one photograph as an object, and the film strip.
// landing-page.tsx renders it. It reads its texts from the "hero" group of messages.ts.
// The claim and the photograph never overlap: type sits beside a picture, not on it.
import { useT } from "~/shared/i18n";
import {
	BUTTON_FILL,
	BUTTON_GHOST,
	CAPTION,
	KICKER,
	META,
	WRAP,
} from "../lib/styles";
import { FilmStrip } from "./film-strip";
import { PhotoFrame } from "./photo-frame";

/** A 1.12 / 0.88 split from 760px. Below, the photograph moves onto film base under the text. */
export function HeroSection() {
	const { t } = useT();
	return (
		<section
			id="top"
			aria-labelledby="hero-title"
			className="pt-4 sm:pt-[clamp(1.6rem,3.4vh,2.8rem)]"
		>
			<div
				className={`${WRAP} grid items-start gap-[26px] pb-[clamp(1.8rem,3.6vh,2.6rem)] min-[760px]:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] min-[760px]:items-end min-[760px]:gap-[clamp(26px,4.2vw,64px)]`}
			>
				<div>
					<p className={KICKER}>{t("hero.kicker")}</p>
					{/* The English claim has short lines. A large size fills the text column beside the photograph. */}
					<h1
						id="hero-title"
						className="mt-5 font-display font-extrabold text-[clamp(2.6rem,6.6vw,6.2rem)] leading-[1.02] tracking-[-0.028em]"
					>
						<span className="block">{t("hero.titleLine1")}</span>
						<span className="block">{t("hero.titleLine2")}</span>
						{/* The one grey word of the claim. Grey is the only emphasis of this world. */}
						<span className="block text-primary">{t("hero.titleLine3")}</span>
					</h1>
					<p className="mt-5 max-w-[40ch] text-pretty text-[clamp(1.06rem,0.98rem_+_0.42vw,1.26rem)] sm:mt-6">
						{t("hero.lead")}
					</p>
					<div className="mt-6 flex flex-wrap gap-2.5 sm:mt-[30px]">
						<a href="#series" className={BUTTON_FILL}>
							{t("hero.ctaSeries")}
						</a>
						<a href="#contact" className={BUTTON_GHOST}>
							{t("hero.ctaContact")}
						</a>
					</div>
					<p
						className={`${META} mt-[22px] flex flex-wrap gap-x-3 gap-y-1.5 whitespace-nowrap border-foreground/15 border-t pt-3.5 max-[479px]:text-[0.62rem] sm:mt-[26px] sm:gap-x-[18px]`}
					>
						<span>{t("hero.stock1")}</span>
						<span>{t("hero.stock2")}</span>
						<span>{t("hero.stock3")}</span>
					</p>
				</div>
				<figure className="yr-hero-figure">
					<PhotoFrame
						photo="window"
						number="36A"
						exif="full"
						isPriority
						// Between 560px and 759px a full-width 4:5 frame is higher than the screen, so the frame turns wide.
						className="aspect-[4/5] min-[560px]:max-[759px]:aspect-[5/4]"
						imageClassName="object-[50%_32%]"
					/>
					<figcaption
						className={`${CAPTION} flex flex-wrap justify-between gap-x-4 gap-y-1`}
					>
						<span>
							<span className="text-foreground">{t("hero.captionPlace")}</span>
							{" — "}
							{t("hero.captionDate")}
						</span>
						<span>{t("hero.captionRoll")}</span>
					</figcaption>
				</figure>
			</div>
			<FilmStrip />
		</section>
	);
}
