// One villa type of the villas grid: a photo with its price plate and its reference strip, then a name and one line.
// VillasSection renders three of them with different widths and photo ratios.
import { cn } from "~/shared/lib/utils";
import { H3 } from "../lib/type-styles";
import { Aperture } from "./aperture";
import { PricePlate } from "./price-plate";
import { ReferenceStrip, type StripCell } from "./reference-strip";

type VillaLotProps = {
	/** The villa type name, for example "Villa Pin". Already translated. */
	name: string;
	/** One factual line under the name. Already translated. */
	text: string;
	/** The photo: its path under public/, its pixel size, and its translated description. */
	image: { src: string; alt: string; width: number; height: number };
	/** The small line and the figure of the price plate. */
	plate: { label: string; value: string };
	/** The top corner of the photo for the plate. The grid alternates it card by card. */
	plateCorner: "start" | "end";
	/** The four cells of the strip: surface, bedrooms, view, reference. */
	cells: readonly StripCell[];
	/** Grid placement of the card: its column span and its offset. */
	className?: string;
	/** The aspect ratio classes of the photo frame. */
	frameClassName: string;
	/** The `object-position` classes of the photo, for a crop that differs from another use of the same photo. */
	imageClassName?: string;
	/** True for the full-width card: from 1024px the name and the line then sit side by side, 7 columns to 5. */
	isBand?: boolean;
};

/** An <article> with the name as its <h3>. */
export function VillaLot({
	name,
	text,
	image,
	plate,
	plateCorner,
	cells,
	className,
	frameClassName,
	imageClassName,
	isBand = false,
}: VillaLotProps) {
	return (
		<article className={cn("min-w-0", className)}>
			<Aperture
				src={image.src}
				alt={image.alt}
				width={image.width}
				height={image.height}
				className={frameClassName}
				imageClassName={imageClassName}
			>
				<PricePlate
					label={plate.label}
					value={plate.value}
					corner={plateCorner}
				/>
				<ReferenceStrip cells={cells} />
			</Aperture>
			<div
				data-reveal="lift"
				className={cn(
					"mt-[clamp(1.4rem,2vw,1.9rem)] grid gap-[0.55rem]",
					isBand &&
						"lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-baseline lg:gap-x-[clamp(1.6rem,2.6vw,2.6rem)]",
				)}
			>
				<h3 className={H3}>{name}</h3>
				<p className="max-w-[42ch] text-[0.98rem] text-foreground/75 leading-[1.7]">
					{text}
				</p>
			</div>
		</article>
	);
}
