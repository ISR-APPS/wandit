// The reference strip: four facts on the bottom edge of a photo, for example surface, bedrooms, view, reference.
// The hero, the villa cards, and the room tour render it inside a photo frame.
// landing.css folds it from one row of four cells to two rows of two on a narrow photo.
import { cn } from "~/shared/lib/utils";
import { WRAP } from "../lib/type-styles";

/** One cell of the strip. Both texts are already translated. */
export type StripCell = {
	/** The small bronze key, for example "Surface". */
	label: string;
	/** The serif value, for example "448 m²". */
	value: string;
};

type ReferenceStripProps = {
	/** Four cells, in reading order. */
	cells: readonly StripCell[];
	/** True on a full-bleed photo: the cells then start on the edge of the page column. */
	isBleed?: boolean;
	className?: string;
};

/** An ivory band at 96% on the photo. It is a description list, so a screen reader pairs each key with its value. */
export function ReferenceStrip({
	cells,
	isBleed = false,
	className,
}: ReferenceStripProps) {
	const list = (
		<dl className={cn("dlp-strip", isBleed && "dlp-strip-bleed")}>
			{cells.map((cell) => (
				<div
					key={cell.label}
					className="dlp-strip-cell px-[clamp(0.55rem,1.3vw,1.1rem)] pt-[0.62rem] pb-[0.68rem]"
				>
					{/* A line height of 1.55 keeps the accent of a capital inside the clipped cell. */}
					<dt className="truncate font-semibold text-(--dlp-bronze-deep) text-[9.5px] uppercase leading-[1.55] tracking-[0.19em]">
						{cell.label}
					</dt>
					<dd className="mt-[0.12rem] truncate font-display text-[clamp(0.86rem,1.05vw,1.06rem)] leading-[1.25]">
						{cell.value}
					</dd>
				</div>
			))}
		</dl>
	);
	return (
		<div
			className={cn(
				"absolute inset-x-0 bottom-0 z-2 border-foreground/12 border-t bg-background/96",
				className,
			)}
		>
			{isBleed ? <div className={WRAP}>{list}</div> : list}
		</div>
	);
}
