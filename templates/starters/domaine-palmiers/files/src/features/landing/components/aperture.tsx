// The framed photo of the home page: square corners, a hairline frame, and the dusk grade of landing.css.
// The hero, the villa cards, the evening band, the specification, and the contact section render it.
// Its children are the furniture on the photo: a PricePlate and a ReferenceStrip.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";

type ApertureProps = {
	/** Path of the photo under public/, for example "/images/terrace.webp". */
	src: string;
	/** Translated description of the photo. */
	alt: string;
	/** Pixel size of the photo file. The browser reserves the space from it. */
	width: number;
	/** Pixel height of the photo file. */
	height: number;
	/** True for the first photo of the page: it loads at once. The other photos load near the viewport. */
	isEager?: boolean;
	/** True in the contact section: the photo then has no scroll reveal. */
	isStill?: boolean;
	/** Classes of the frame: the aspect ratio, the height cap, the bleed borders. */
	className?: string;
	/** Classes of the image: the crop position. */
	imageClassName?: string;
	/** The plate and the strip that sit on the photo. */
	children?: ReactNode;
};

/** One photo in its frame. It reveals with a rise and a curtain when it scrolls into view, unless `isStill` is true. */
export function Aperture({
	src,
	alt,
	width,
	height,
	isEager = false,
	isStill = false,
	className,
	imageClassName,
	children,
}: ApertureProps) {
	return (
		<figure
			data-reveal={isStill ? undefined : "photo"}
			className={cn(
				"dlp-media relative w-full border border-foreground/12 bg-secondary transition-colors duration-[350ms] hover:border-foreground/24",
				className,
			)}
		>
			<img
				src={src}
				alt={alt}
				width={width}
				height={height}
				loading={isEager ? "eager" : "lazy"}
				fetchPriority={isEager ? "high" : "auto"}
				decoding="async"
				className={cn("block size-full object-cover", imageClassName)}
			/>
			{children}
		</figure>
	);
}
