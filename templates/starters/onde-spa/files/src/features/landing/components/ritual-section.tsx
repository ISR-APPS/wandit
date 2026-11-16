// The showpiece: the ritual in three stages. A photo stage sits beside a numbered rail.
// At 1024 px and wider, while the section travels up the screen, the rail draws, the active step gets its ring, and the photo changes inside a swell of steam.
// LandingPage renders it after the hero. useRitualScrub drives it; landing.css shows the still frame without it.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useRitualScrub } from "../hooks/use-ritual-scrub";
import { PHOTOS } from "../lib/photos";
import { BODY_TEXT, LABEL, WRAP } from "../lib/styles";
import { RitualStep } from "./ritual-step";

/** The <section id="ritual"> that the header link "the ritual" opens. */
export function RitualSection() {
	const { t } = useT();
	const sectionRef = useRef<HTMLElement>(null);
	useRitualScrub(sectionRef);
	return (
		<section
			ref={sectionRef}
			id="ritual"
			aria-labelledby="ritual-title"
			className="relative bg-(--onde-ground-b)"
		>
			<div className="py-[clamp(4rem,8.5vh,6.5rem)]">
				<div
					className={cn(
						WRAP,
						"grid grid-cols-1 gap-[clamp(1.5rem,3.4vh,2.6rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:grid-rows-[auto_1fr] lg:gap-x-[clamp(2rem,4.4vw,4.6rem)] lg:[grid-template-areas:'stage_head'_'stage_rail']",
					)}
				>
					<div data-reveal="" className="lg:[grid-area:head]">
						<p className={LABEL}>{t("ritual.label")}</p>
						<h2
							id="ritual-title"
							className="mt-4 max-w-[18ch] text-balance font-display font-normal text-[clamp(1.85rem,2.9vw,2.7rem)] leading-[1.1] tracking-[-0.008em] lg:max-w-[14ch]"
						>
							{t("ritual.title")}
						</h2>
						<p className={cn(BODY_TEXT, "mt-4 max-w-[38ch] text-[0.95rem]")}>
							{t("ritual.body")}
						</p>
					</div>
					{/* The photos stack in reverse ritual order, so the still page shows stage 01 on top. */}
					<div
						role="img"
						aria-label={t("ritual.stageAlt")}
						className="onde-photo h-[clamp(240px,34vh,340px)] rounded-lg lg:h-auto lg:min-h-[clamp(280px,58vh,560px)] lg:self-stretch lg:[grid-area:stage]"
					>
						<img
							src={PHOTOS.teaTray.src}
							alt=""
							width={PHOTOS.teaTray.width}
							height={PHOTOS.teaTray.height}
							loading="lazy"
							decoding="async"
							className="object-[50%_60%]"
						/>
						<img
							src={PHOTOS.coldPool.src}
							alt=""
							width={PHOTOS.coldPool.width}
							height={PHOTOS.coldPool.height}
							loading="lazy"
							decoding="async"
							data-photo="cold-pool"
							className="onde-ritual-photo object-[50%_58%]"
						/>
						{/* The arch of the room sits in the left third of the file. Both crops keep it out of frame.
						    On a phone the stage follows the hero, so it zooms on the steam and the cornice light, not on the bench. */}
						<img
							src={PHOTOS.steamRoom.src}
							alt=""
							width={PHOTOS.steamRoom.width}
							height={PHOTOS.steamRoom.height}
							loading="lazy"
							decoding="async"
							data-photo="steam-room"
							className="onde-ritual-photo origin-[40%_10%] scale-[1.6] object-[78%_50%] lg:origin-[60%_50%] lg:scale-100 lg:object-[64%_52%]"
						/>
						<span aria-hidden="true" className="onde-ritual-steam" />
					</div>
					<div className="relative lg:[grid-area:rail]">
						<span
							aria-hidden="true"
							className="onde-ritual-line absolute start-[23px] top-[26px] bottom-[30px] w-px bg-(--onde-hair-strong)"
						/>
						<ol className="relative m-0 grid list-none content-start gap-[clamp(1.2rem,2.8vh,2.1rem)] p-0">
							<RitualStep
								position={1}
								title={t("ritual.step1Title")}
								body={t("ritual.step1Body")}
								meta={t("ritual.step1Meta")}
							/>
							<RitualStep
								position={2}
								title={t("ritual.step2Title")}
								body={t("ritual.step2Body")}
								meta={t("ritual.step2Meta")}
							/>
							<RitualStep
								position={3}
								title={t("ritual.step3Title")}
								body={t("ritual.step3Body")}
								meta={t("ritual.step3Meta")}
							/>
						</ol>
					</div>
				</div>
			</div>
		</section>
	);
}
