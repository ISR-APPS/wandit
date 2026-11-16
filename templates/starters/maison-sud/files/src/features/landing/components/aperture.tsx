// A framed photograph: square corners, a 1px frame at 10% ink, and the shared cool grade.
// The sections of this feature render it. Text never sits on the photo: a Plinth or a caption goes in `children`.
// use-scroll-reveal.ts reads its data-reveal attribute, and landing.css draws the walk-in.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { PHOTO_FRAME, PHOTO_GRADE } from "../lib/type-styles";

// On a phone, a square and a portrait become 4/5, and a band becomes 4/3, so each photo keeps a useful height.
// "bandFromPortrait" is a band cut from an upright file: on a phone it shows the file almost whole, at 4/5.
const SHAPE_CLASS_NAMES = {
	square: "aspect-[4/5] md:aspect-square",
	portrait: "aspect-[4/5] md:aspect-[3/4]",
	band: "aspect-[4/3] md:aspect-[2/1]",
	bandFromPortrait: "aspect-[4/5] md:aspect-[2/1]",
} as const;

type ApertureProps = {
	/** Public path of the WebP file, for example "/images/kitchen.webp". */
	src: string;
	/** Translated description of the photo. */
	alt: string;
	/** Pixel width of the file. With `height`, it lets the browser reserve the space. */
	width: number;
	/** Pixel height of the file. */
	height: number;
	/** The crop of the frame from 768px. */
	shape: keyof typeof SHAPE_CLASS_NAMES;
	/** Tailwind object-position class that keeps the subject in the crop. */
	focusClassName?: string;
	/** True for the photo of the first screen. It loads at once; the others load when the visitor comes near. */
	isAboveFold?: boolean;
	/** Grid placement and the margin that makes room for a plinth. */
	className?: string;
	/** A Plinth, or a figcaption under the frame. */
	children?: ReactNode;
};

/** One photograph in its frame. The figure is the positioning parent of a Plinth. */
export function Aperture({
	src,
	alt,
	width,
	height,
	shape,
	focusClassName,
	isAboveFold = false,
	className,
	children,
}: ApertureProps) {
	return (
		<figure
			data-reveal="aperture"
			className={cn("relative ms-fig self-start", className)}
		>
			<div className={cn(PHOTO_FRAME, SHAPE_CLASS_NAMES[shape])}>
				<img
					src={src}
					alt={alt}
					width={width}
					height={height}
					loading={isAboveFold ? "eager" : "lazy"}
					decoding="async"
					className={cn("size-full object-cover", PHOTO_GRADE, focusClassName)}
				/>
			</div>
			{children}
		</figure>
	);
}
