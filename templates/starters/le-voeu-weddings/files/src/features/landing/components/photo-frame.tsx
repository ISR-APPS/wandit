// A photograph of the home page: square corners, one warm grade, a gold rule engraved 13px inside, and a caption.
// The sections of the landing feature render it. landing.css draws the grade and the rule (.voeu-photo).
// Every photo of the page goes through this component, so no photo can miss its caption.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { CAPTION } from "../lib/type-styles";

type PhotoFrameProps = {
	/** Path under public/, for example "/images/table.webp". */
	src: string;
	/** Translated description of the photo. */
	alt: string;
	/** Pixel size of the file. The browser reserves the space before the image loads. */
	width: number;
	height: number;
	/** Translated caption: names, place, guest count, month. */
	caption: string;
	/** Shape and size of the frame, for example "aspect-[3/4]". */
	frameClassName: string;
	/** Classes of the <figure>. */
	className?: string;
	/** Classes of the <img>, for example an object-position. */
	imageClassName?: string;
	/** True for a frame shot cooler than the others. It gets a little sepia. */
	isCool?: boolean;
	/** True below the first screen: the browser loads the image when it comes near. */
	isLazy?: boolean;
	/** "photo" lifts the frame in on the scroll. "enter" lifts it at page load (the first screen). */
	motion?: "photo" | "enter";
	/** Something drawn over the frame edge, such as a script word. It sits outside the frame, so the frame does not clip it. */
	overlay?: ReactNode;
};

/** A <figure> with the framed image and a caption on a gold rule. */
export function PhotoFrame({
	src,
	alt,
	width,
	height,
	caption,
	frameClassName,
	className,
	imageClassName,
	isCool = false,
	isLazy = true,
	motion,
	overlay,
}: PhotoFrameProps) {
	return (
		<figure className={cn("relative m-0", className)}>
			{overlay}
			<div
				data-reveal={motion === "photo" ? "photo" : undefined}
				className={cn(
					"voeu-photo",
					isCool && "voeu-photo-cool",
					motion === "enter" && "voeu-enter-photo",
					frameClassName,
				)}
			>
				<img
					src={src}
					alt={alt}
					width={width}
					height={height}
					loading={isLazy ? "lazy" : "eager"}
					decoding="async"
					className={imageClassName}
				/>
			</div>
			<figcaption className={CAPTION}>{caption}</figcaption>
		</figure>
	);
}
