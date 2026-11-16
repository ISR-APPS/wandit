// A photo as a navy duotone plate with its caption below it. The hero, the case study, and the head office use it.
// landing.css draws the two inks on .cap-plate. The caption sits outside the photo: no text ever lies on a photo.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { LABEL, SOFT } from "../lib/type-styles";

type DuotonePlateProps = {
	/** Path of the WebP file under public/, for example "/images/lobby-dusk.webp". */
	src: string;
	/** Translated description of the photo. */
	alt: string;
	/** Pixel size of the file. The browser keeps the space before the file loads. */
	width: number;
	height: number;
	/** False for the hero photo, which is on the first screen. */
	isLazy: boolean;
	/** True for a dark interior: the photo is brightened before the duotone. */
	isLifted?: boolean;
	/** Ratio or height classes of the photo frame. */
	frameClassName: string;
	/** The caps line of the caption: a place and a year. */
	captionLine: string;
	/** One sentence of context under the caps line. */
	captionNote: string;
	/** A micro line at the end edge of the caption, for example "Head office since 2009". */
	captionSide?: ReactNode;
	/** Classes of the caption block, for example an end padding when the photo bleeds. */
	captionClassName?: string;
};

/** A figure: the square photo frame, then a 40px navy rule, the place line, and the context sentence. */
export function DuotonePlate({
	src,
	alt,
	width,
	height,
	isLazy,
	isLifted = false,
	frameClassName,
	captionLine,
	captionNote,
	captionSide,
	captionClassName,
}: DuotonePlateProps) {
	return (
		<figure>
			<div
				className={cn(
					"cap-plate",
					isLifted && "cap-plate-lifted",
					frameClassName,
				)}
			>
				<img
					src={src}
					alt={alt}
					width={width}
					height={height}
					loading={isLazy ? "lazy" : undefined}
				/>
			</div>
			<figcaption
				className={cn(
					"flex flex-wrap items-end justify-between gap-x-8 gap-y-2.5 pt-3.5",
					captionClassName,
				)}
			>
				<div className="min-w-0">
					<div aria-hidden="true" className="mb-3 h-px w-10 bg-primary" />
					<p className={cn(LABEL, "text-primary")}>{captionLine}</p>
					<p className={cn(SOFT, "mt-1 max-w-[38ch] text-sm leading-normal")}>
						{captionNote}
					</p>
				</div>
				{captionSide}
			</figcaption>
		</figure>
	);
}
