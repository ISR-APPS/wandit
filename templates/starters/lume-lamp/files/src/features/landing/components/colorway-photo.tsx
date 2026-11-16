// The two colorway photos stacked in one arch frame. The chosen one shows; the other fades out and grows to 104%.
// HeroStage and the order card of ReserveSection render it. The frame shape comes from the caller's classes.
import { useT } from "~/shared/i18n";
import { COLORWAYS, type Colorway } from "../lib/colorways";

type ColorwayPhotoProps = {
	colorway: Colorway;
	/** Classes of the frame: the arch scale, the shadow, the entrance. */
	className: string;
	/** True for the hero: the first photo loads at high priority. False loads both lazily. */
	isHero: boolean;
	/** True when another element already describes the photo. Then both photos get an empty alt. */
	isDecorative: boolean;
};

/** A 4:5 frame. Both photos stay in the HTML, so the swap needs no network request. */
export function ColorwayPhoto({
	colorway,
	className,
	isHero,
	isDecorative,
}: ColorwayPhotoProps) {
	const { t } = useT();
	return (
		<div className={`lume-swap lume-arch aspect-[4/5] ${className}`}>
			{COLORWAYS.map((option, index) => {
				const isActive = option.id === colorway;
				const isLcp = isHero && index === 0;
				return (
					<img
						key={option.id}
						src={option.src}
						width={option.width}
						height={option.height}
						alt={isDecorative ? "" : t(option.altKey)}
						aria-hidden={isActive ? undefined : true}
						data-active={isActive}
						loading={isLcp ? "eager" : "lazy"}
						fetchPriority={isLcp ? "high" : undefined}
					/>
				);
			})}
		</div>
	);
}
