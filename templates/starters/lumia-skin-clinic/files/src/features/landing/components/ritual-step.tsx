// One step of the ritual: the serif number and name, one short line, a petal on the axis, and a small drifting photo.
// RitualSection renders four of them. From 768px the steps alternate sides of a center axis.
// On a phone the axis moves to the start edge and the photos hide, so the text keeps its full width.
import { cn } from "~/shared/lib/utils";
import type { Photo } from "../lib/photos";
import { PetalGlyph } from "./petal-glyph";
import { PhotoMask } from "./photo-mask";

type RitualStepProps = {
	/** Position in the ritual, from 1 to 4. Odd steps put the text before the axis, even steps after it. */
	position: number;
	title: string;
	body: string;
	photo: Photo;
	/** Translated description of the photo. */
	alt: string;
	/** The drift phase class of landing.css, "lumia-ritual-drift-1" to 4. */
	driftClassName: string;
	/** An object-position class that picks the crop. */
	imageClassName?: string;
};

/** An <li> of the ritual list, on a three-column grid from 768px. */
export function RitualStep({
	position,
	title,
	body,
	photo,
	alt,
	driftClassName,
	imageClassName,
}: RitualStepProps) {
	const isOdd = position % 2 === 1;
	return (
		<li
			data-reveal=""
			className="relative grid grid-cols-[50px_minmax(0,1fr)] items-start py-6 md:min-h-[190px] md:grid-cols-[minmax(0,1fr)_78px_minmax(0,1fr)] md:items-center md:py-0"
		>
			<div
				className={cn(
					"col-start-2 row-start-1 grid min-w-0 gap-2.5",
					isOdd ? "md:col-start-1 md:text-end" : "md:col-start-3",
				)}
			>
				<div
					className={cn(
						"flex items-baseline gap-[0.85rem]",
						isOdd && "md:justify-end",
					)}
				>
					<span
						aria-hidden="true"
						className="font-display text-(--lumia-bronze-deep) text-[1.6rem] leading-none md:text-[2rem]"
					>
						{String(position).padStart(2, "0")}
					</span>
					<h3 className="font-display font-normal text-[clamp(1.55rem,2.5vw,2.15rem)] leading-[1.1]">
						{title}
					</h3>
				</div>
				<p
					className={cn(
						"max-w-[36ch] text-pretty text-[16px]",
						isOdd && "md:ms-auto",
					)}
				>
					{body}
				</p>
			</div>
			<span
				aria-hidden="true"
				className="relative z-[1] col-start-1 row-start-1 -mt-0.5 grid size-[38px] place-items-center justify-self-center rounded-full border border-foreground/16 bg-background text-primary md:col-start-2 md:mt-0"
			>
				<PetalGlyph className="size-[15px]" />
			</span>
			<div
				className={cn(
					"row-start-1 hidden w-[clamp(120px,12vw,150px)] md:block",
					isOdd
						? "md:col-start-3 md:ms-[clamp(0.75rem,3vw,2.5rem)] md:justify-self-start"
						: "md:col-start-1 md:me-[clamp(0.75rem,3vw,2.5rem)] md:justify-self-end",
				)}
			>
				<div className={cn("lumia-drift", driftClassName)}>
					<PhotoMask
						photo={photo}
						alt={alt}
						isFloating
						maskClassName="h-[clamp(140px,14vw,175px)] rounded-[30px]"
						imageClassName={imageClassName}
					/>
				</div>
			</div>
		</li>
	);
}
