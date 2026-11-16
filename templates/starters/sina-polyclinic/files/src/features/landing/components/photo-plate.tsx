// One photograph of the clinic in its frame: a hairline plate, a teal corner tick, and a caption under it.
// The hero, the practitioners, the oath, and the booking sections render one each.
// Text never sits on the photo. The caption names a place and an hour.
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/type-styles";

type PhotoPlateProps = {
	/** A path under public/, for example "/images/corridor.webp". */
	src: string;
	alt: string;
	/** The pixel size of the file. The browser keeps the space before the file loads. */
	width: number;
	height: number;
	/** The small-caps line under the frame. */
	caption: string;
	/** True only for the photo of the first screen. Every other photo loads when it comes near the screen. */
	isEager?: boolean;
	/** Classes of the figure: its place in the grid of the section. */
	className?: string;
	/** Classes of the frame: its ratio or its height. The photo fills the frame. */
	frameClassName: string;
	/** Classes of the image, for example the point of the photo that stays in view. */
	imageClassName?: string;
};

/** The frame gives the size, and the photo covers it. All photos take the same cool grade. */
export function PhotoPlate({
	src,
	alt,
	width,
	height,
	caption,
	isEager = false,
	className,
	frameClassName,
	imageClassName,
}: PhotoPlateProps) {
	return (
		<figure data-reveal="rise" className={className}>
			<div
				className={cn(
					"sp-tick rounded-(--sp-chamfer) border border-border bg-card",
					frameClassName,
				)}
			>
				{/* The clip is on an inner box, so the corner tick can cross the hairline of the frame. */}
				<div className="absolute inset-0 overflow-hidden rounded-[inherit]">
					<img
						src={src}
						alt={alt}
						width={width}
						height={height}
						loading={isEager ? "eager" : "lazy"}
						decoding="async"
						className={cn(
							"size-full object-cover brightness-[1.02] contrast-[1.03] saturate-[.92]",
							imageClassName,
						)}
					/>
				</div>
			</div>
			<figcaption
				className={cn(
					LABEL,
					"mt-2.5 text-muted-foreground leading-4 tracking-[0.12em]",
				)}
			>
				{caption}
			</figcaption>
		</figure>
	);
}
