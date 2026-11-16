// The Lumia ritual: four numbered steps hung on a center axis, each with a small drifting photo.
// LandingPage renders it on the cream, between the treatments and the window photo.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PHOTOS } from "../lib/photos";
import { GUTTER, SECTION_TITLE, SECTION_Y, WRAP } from "../lib/type-styles";
import { CapsuleBadge } from "./capsule-badge";
import { RitualStep } from "./ritual-step";

/** The <section id="ritual"> that the header link "The ritual" opens. */
export function RitualSection() {
	const { t } = useT();
	return (
		<section
			id="ritual"
			aria-labelledby="ritual-title"
			className={cn("scroll-mt-4 bg-background", GUTTER, SECTION_Y)}
		>
			<div className={WRAP}>
				<div
					data-reveal=""
					className="mb-[clamp(2.5rem,5vw,4.5rem)] grid max-w-[760px] gap-[1.1rem] md:mx-auto md:justify-items-center md:text-center"
				>
					<CapsuleBadge tone="cream">{t("ritual.badge")}</CapsuleBadge>
					<h2 id="ritual-title" className={SECTION_TITLE}>
						{t("ritual.title")}
					</h2>
				</div>
				{/* The axis: a cacao hairline at the start edge on a phone, in the middle from 768px. */}
				<ol className="relative m-0 mx-auto w-full max-w-[980px] list-none p-0 py-2 before:absolute before:inset-y-0 before:start-[19px] before:w-px before:bg-(--lumia-hair) before:content-[''] md:before:start-1/2">
					<RitualStep
						position={1}
						title={t("ritual.step1Title")}
						body={t("ritual.step1Body")}
						photo={PHOTOS.facial}
						alt={t("ritual.step1Alt")}
						driftClassName="lumia-ritual-drift-1"
						imageClassName="object-[62%_center]"
					/>
					<RitualStep
						position={2}
						title={t("ritual.step2Title")}
						body={t("ritual.step2Body")}
						photo={PHOTOS.ceramics}
						alt={t("ritual.step2Alt")}
						driftClassName="lumia-ritual-drift-2"
						imageClassName="object-[18%_58%]"
					/>
					<RitualStep
						position={3}
						title={t("ritual.step3Title")}
						body={t("ritual.step3Body")}
						photo={PHOTOS.serum}
						alt={t("ritual.step3Alt")}
						driftClassName="lumia-ritual-drift-3"
						imageClassName="object-[70%_center]"
					/>
					<RitualStep
						position={4}
						title={t("ritual.step4Title")}
						body={t("ritual.step4Body")}
						photo={PHOTOS.hands}
						alt={t("ritual.step4Alt")}
						driftClassName="lumia-ritual-drift-4"
						imageClassName="object-[30%_center]"
					/>
				</ol>
			</div>
		</section>
	);
}
