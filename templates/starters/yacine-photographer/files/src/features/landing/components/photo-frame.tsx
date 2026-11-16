// One photograph as an object: the image, its frame number, and its EXIF chip.
// Every section of the home page renders its photographs through it.
// It reads PHOTOS and exifOf from lib/photos.ts; landing.css draws the grade, the grain, and the chip.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { type ExifDetail, PHOTOS, type PhotoId } from "../lib/photos";

type PhotoFrameProps = {
	photo: PhotoId;
	/** The ratio and the size of the frame, as Tailwind classes. The frame takes its width from its parent. */
	className?: string;
	/** Classes of the image, for example an object-position that keeps the subject in the crop. */
	imageClassName?: string;
	/** The frame number that the film edge prints, for example "21A". Absent on the wall. */
	number?: string;
	/** "corner": top corner, for a single photograph. "base": bottom corner, for a strip or a sheet. */
	numberPlace?: "corner" | "base";
	/** How much of the exposure the chip prints at most. A narrow frame drops the lens, then the film speed. */
	exif: ExifDetail;
	/** True for the hero photograph: the browser loads it first. All other images load when they come near. */
	isPriority?: boolean;
	/** True on the wall: the window of the wall carries the one label, so the image has an empty alt. */
	isDecorative?: boolean;
};

/** A square-cornered frame with no tab stop: it has no action. Hover cuts the grade brighter and slides the EXIF chip in. */
export function PhotoFrame({
	photo,
	className,
	imageClassName,
	number,
	numberPlace = "corner",
	exif,
	isPriority = false,
	isDecorative = false,
}: PhotoFrameProps) {
	const { t } = useT();
	const { src, width, height, altKey, aperture, shutter, iso, lens } =
		PHOTOS[photo];
	const isBaseNumber = number !== undefined && numberPlace === "base";
	return (
		<div className={cn("yr-ph", className)}>
			<img
				src={src}
				width={width}
				height={height}
				alt={isDecorative ? "" : t(altKey)}
				loading={isPriority ? undefined : "lazy"}
				fetchPriority={isPriority ? "high" : undefined}
				className={imageClassName}
			/>
			{/* dir="ltr": the apertures and the fractions keep their order in a right-to-left language. */}
			<span
				dir="ltr"
				className={cn("yr-exif yr-mono", isBaseNumber && "yr-exif-top")}
			>
				{aperture} · {shutter}
				{exif !== "short" && <span className="yr-exif-iso"> · {iso}</span>}
				{exif === "full" && <span className="yr-exif-lens"> · {lens}</span>}
			</span>
			{number !== undefined && (
				<span
					dir="ltr"
					className={cn("yr-fnum yr-mono", isBaseNumber && "yr-fnum-base")}
				>
					{number}
				</span>
			)}
		</div>
	);
}
