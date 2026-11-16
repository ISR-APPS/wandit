// The water band: a wide macro of the cold pool beside the one quote of the page.
// LandingPage renders it after the treatments. The photo bleeds off the start edge of the screen.
import { useT } from "~/shared/i18n";
import { PHOTOS } from "../lib/photos";
import { LABEL } from "../lib/styles";
import { GradedPhoto } from "./graded-photo";
import { PebbleDivider } from "./pebble-divider";
import { SteamVeil } from "./steam-veil";

/** A two-column band on ground B: the photo takes 1.28 parts, the quote 0.72. */
export function WaterSection() {
	const { t } = useT();
	return (
		<section
			aria-label={t("water.sectionLabel")}
			className="relative grid grid-cols-1 bg-(--onde-ground-b) lg:grid-cols-[minmax(0,1.28fr)_minmax(0,0.72fr)] lg:items-stretch"
		>
			<SteamVeil kind="seam" phase={1} />
			<GradedPhoto
				photo={PHOTOS.coldPool}
				alt={t("water.poolAlt")}
				maskClassName="h-[clamp(300px,46vh,440px)] lg:h-[clamp(360px,58vh,600px)] lg:rounded-e-lg"
				imageClassName="object-[52%_62%]"
				caption={t("water.caption")}
				captionSide="start"
			/>
			<div className="relative z-3 flex flex-col justify-center py-[clamp(2.6rem,7vh,4.6rem)] ps-[clamp(20px,4.4vw,64px)] pe-[clamp(20px,4.4vw,64px)] lg:ps-[clamp(2rem,4.4vw,5rem)] lg:pe-[max(clamp(20px,4.4vw,64px),calc((100vw_-_1240px)/2))]">
				<p data-reveal="" className={LABEL}>
					{t("water.label")}
				</p>
				<blockquote
					data-reveal=""
					className="m-0 mt-[1.4rem] max-w-[16ch] text-balance font-display text-[clamp(1.7rem,2.55vw,2.5rem)] leading-[1.2]"
				>
					{t("water.quote")}
				</blockquote>
				<p
					data-reveal=""
					className="mt-[1.6rem] max-w-[36ch] text-(--onde-ink-66) text-[0.83rem] tracking-[0.02em]"
				>
					{t("water.author")}
				</p>
				<PebbleDivider phase={2} className="mt-[clamp(1.6rem,3.4vh,2.6rem)]" />
			</div>
		</section>
	);
}
