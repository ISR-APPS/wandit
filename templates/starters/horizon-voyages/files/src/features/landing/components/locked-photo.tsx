// A square-cornered photo frame that puts the horizon of its photo on the lock line.
// Every section with a photograph renders it. The caller sets the frame size with classes; the lock comes from lib/photos.ts.
// landing.css (.hz-frame) holds the arithmetic, the grade, the hover brighten, and the drawn rule.
import { cn } from "~/shared/lib/utils";
import type { Photo, PhotoLock } from "../lib/photos";
import type { CssVariableStyle } from "../lib/type-styles";

type LockedPhotoProps = {
	photo: Photo;
	/** The crop at 900px and wider, and on a phone when `phoneLock` is absent. */
	lock: PhotoLock;
	/** A second crop under 900px, where the frame has another height and so another lock. */
	phoneLock?: PhotoLock;
	/** Translated description of the photo. */
	alt: string;
	/** Frame size classes: a definite height is required, the width fills the parent by default. */
	className?: string;
	/**
	 * Draws the 2px sun rule over the photo at `ruleAt` of the frame height.
	 * "phone" draws it only under 900px, where a shared rule across the grid is impossible.
	 */
	rule?: "always" | "phone";
	/** Height of the rule as a share of the frame height, 0 to 1. The lock height of the crop. */
	ruleAt?: number;
	/** True for the first screen: the browser loads the photo at once. */
	eager?: boolean;
};

/** Writes the lock of a crop as the three variables that .hz-frame reads. */
function lockVariables(lock: PhotoLock, suffix: string): CssVariableStyle {
	return {
		[`--k${suffix}`]: String(lock.k),
		[`--ty${suffix}`]: `${lock.ty}%`,
		[`--tx${suffix}`]: `${lock.tx ?? 0}%`,
	};
}

/** The frame and its image. Nothing ever sits on the photo except the rule: captions stay on the ground. */
export function LockedPhoto({
	photo,
	lock,
	phoneLock,
	alt,
	className,
	rule,
	ruleAt = 0.34,
	eager = false,
}: LockedPhotoProps) {
	const style: CssVariableStyle = {
		...lockVariables(lock, ""),
		...(phoneLock ? lockVariables(phoneLock, "-phone") : {}),
		"--hz-lock": String(ruleAt),
	};
	return (
		<div
			className={cn("hz-frame", className)}
			style={style}
			data-phone-lock={phoneLock ? "" : undefined}
			data-rule={rule}
		>
			<img
				src={photo.src}
				width={photo.width}
				height={photo.height}
				alt={alt}
				loading={eager ? "eager" : "lazy"}
				decoding="async"
			/>
		</div>
	);
}
