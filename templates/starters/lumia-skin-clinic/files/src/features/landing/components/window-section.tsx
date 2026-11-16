// The window: one large photograph with a caption capsule on its lower corner. An editorial pause between sections.
// LandingPage renders it on the deeper cream. The photo stays inside the cream gutter at every width.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PHOTOS } from "../lib/photos";
import { GUTTER, SECTION_Y } from "../lib/type-styles";
import { CapsuleBadge } from "./capsule-badge";
import { PhotoMask } from "./photo-mask";

/** A <section> with one <figure>. The capsule overlaps the photo edge by half its height. */
export function WindowSection() {
	const { t } = useT();
	return (
		<section
			aria-labelledby="window-caption"
			className={cn("bg-(--lumia-cream-deep)", GUTTER, SECTION_Y)}
		>
			<div data-reveal="" className="mx-auto w-full max-w-[1280px]">
				<PhotoMask
					photo={PHOTOS.ceramics}
					alt={t("window.alt")}
					className="pb-6"
					maskClassName="h-[clamp(430px,112vw,620px)] rounded-[40px] md:h-[clamp(430px,55vw,700px)] md:rounded-[46px]"
					imageClassName="object-[center_64%]"
				>
					<figcaption
						id="window-caption"
						className="absolute start-[clamp(14px,3vw,34px)] bottom-6 z-[2] max-w-[calc(100%-28px)] translate-y-1/2"
					>
						{/* An opaque fill: the caption sits on the dark lower edge of the photo. */}
						<CapsuleBadge className="bg-(--lumia-blush)">
							{t("window.caption")}
						</CapsuleBadge>
					</figcaption>
				</PhotoMask>
			</div>
		</section>
	);
}
