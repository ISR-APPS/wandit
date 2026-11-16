// A photograph of the home page in its 16px mask, with the one grade of the world and an optional caption.
// The treatments, water, house, and booking sections render it. landing.css draws the mask and the grade.
// The mask needs a definite height from `maskClassName`, because the image fills it absolutely.
import { cn } from "~/shared/lib/utils";
import type { Photo } from "../lib/photos";

type GradedPhotoProps = {
	/** The file and its pixel size, from PHOTOS. */
	photo: Photo;
	/** Translated description of the photo. */
	alt: string;
	/** Height and corner classes of the mask, for example "aspect-[5/4] rounded-lg". */
	maskClassName: string;
	/** Classes of the <img>, for example an object-position that picks the quiet part of the frame. */
	imageClassName?: string;
	/** A short fact inside the mask, on its own steam wash, for example "the cold pool — 14°C". */
	caption?: string;
	/** The corner of the in-mask caption. */
	captionSide?: "start" | "end";
	/** A sentence under the mask, in 66% ink. */
	note?: string;
	/** Classes of the <figure>. */
	className?: string;
};

/** A <figure>. Every photo is below the first screen, so every image loads lazily. */
export function GradedPhoto({
	photo,
	alt,
	maskClassName,
	imageClassName,
	caption,
	captionSide = "start",
	note,
	className,
}: GradedPhotoProps) {
	return (
		<figure className={cn("m-0 min-w-0", className)}>
			<div className={cn("onde-photo", maskClassName)}>
				<img
					src={photo.src}
					alt={alt}
					width={photo.width}
					height={photo.height}
					loading="lazy"
					decoding="async"
					className={imageClassName}
				/>
				{caption === undefined ? null : (
					<p
						data-side={captionSide}
						className="onde-caption font-sans text-[0.73rem] text-primary tabular-nums tracking-[0.18em]"
					>
						{caption}
					</p>
				)}
			</div>
			{note === undefined ? null : (
				<figcaption className="mt-[0.85rem] text-(--onde-ink-66) text-[0.8rem] leading-[1.6] tracking-[0.02em]">
					{note}
				</figcaption>
			)}
		</figure>
	);
}
