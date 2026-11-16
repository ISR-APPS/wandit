// One photo of the campus mosaic with its caption chips under it, never on it.
// CampusSection renders three of them. The photo grade and the 14px corner come from landing.css.
import { cn } from "~/shared/lib/utils";
import { CAPTION_FILLED, CAPTION_LINE } from "../lib/type-styles";

type CampusPhotoProps = {
	/** Path under public/, for example "/images/library.webp". */
	src: string;
	alt: string;
	/** Pixel size of the file, so the browser keeps the space before it loads. */
	width: number;
	height: number;
	/** Grid placement of this photo in the mosaic. */
	className: string;
	/** Height of the frame, and the flex rule of the tall frame. */
	frameClassName: string;
	/** The crop: object-position, and a scale when a tight crop hides an artifact. */
	imageClassName: string;
	/** One fact per chip. The first is filled, the second is a hairline pill. */
	captions: readonly string[];
};

/** A lazy photo in a 14px frame. The world allows at most two caption chips. */
export function CampusPhoto({
	src,
	alt,
	width,
	height,
	className,
	frameClassName,
	imageClassName,
	captions,
}: CampusPhotoProps) {
	return (
		<figure data-pop="" className={cn("min-w-0", className)}>
			<div
				className={cn("cn-r overflow-hidden bg-(--cn-pale-2)", frameClassName)}
			>
				<img
					src={src}
					alt={alt}
					width={width}
					height={height}
					loading="lazy"
					className={cn("cn-photo size-full object-cover", imageClassName)}
				/>
			</div>
			<figcaption className="mt-3 flex flex-wrap gap-2">
				{captions.map((caption, index) => (
					<span
						key={caption}
						className={index === 0 ? CAPTION_FILLED : CAPTION_LINE}
					>
						{caption}
					</span>
				))}
			</figcaption>
		</figure>
	);
}
