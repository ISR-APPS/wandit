// The right column of the hero: the lamp on a stage, not a photo in a slot.
// HeroSection renders it. Five layers: the breathing glow, the arch frame with both colorway photos,
// the seal outside the top corner, the toggle across the bottom edge, and the museum caption.
import { useT } from "~/shared/i18n";
import { COLORWAYS, type Colorway } from "../lib/colorways";
import { ColorwayPhoto } from "./colorway-photo";
import { ColorwayToggle } from "./colorway-toggle";
import { EditionSeal } from "./edition-seal";

type HeroStageProps = {
	colorway: Colorway;
	onColorwayChange: (colorway: Colorway) => void;
};

/** At most 30rem wide: the paper around the object is part of the composition. */
export function HeroStage({ colorway, onColorwayChange }: HeroStageProps) {
	const { t } = useT();
	return (
		<div className="relative mb-6 w-[min(100%,26rem)] justify-self-center lg:mb-0 lg:w-[min(100%,30rem)]">
			<div className="lume-glow" aria-hidden="true" />
			<EditionSeal />
			<div className="relative">
				<ColorwayPhoto
					colorway={colorway}
					className="lume-photo-shadow lume-enter-frame"
					isHero
					isDecorative={false}
				/>
				<ColorwayToggle
					colorway={colorway}
					onColorwayChange={onColorwayChange}
				/>
			</div>
			<p
				aria-hidden="true"
				className="lume-enter-soft relative mt-[2.6rem] grid text-center text-(--lume-ink-muted) text-[0.8rem] tracking-[0.06em] [--lume-delay:1.25s]"
			>
				{COLORWAYS.map((option) => (
					<span
						key={option.id}
						data-active={option.id === colorway}
						className="lume-caption-line col-start-1 row-start-1"
					>
						{t(option.captionKey)}
					</span>
				))}
			</p>
		</div>
	);
}
