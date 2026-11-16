// One photo of the hero orbit: a slot that landing.css places, a bloom at page load, a slow drift, and the mask.
// HeroSection renders four of them. The slot class (lumia-orbit-1 to 4) gives the place, the size, and the drift phase.
// PhotoMask draws the masked image.
import { cn } from "~/shared/lib/utils";
import type { Photo } from "../lib/photos";
import { PhotoMask } from "./photo-mask";

type OrbitPhotoProps = {
	/** The file and its pixel size, from PHOTOS. */
	photo: Photo;
	/** Translated description of the photo. */
	alt: string;
	/** The slot class of landing.css, "lumia-orbit-1" to "lumia-orbit-4". */
	slotClassName: string;
	/** An animation-delay class, so the four photos bloom one after the other. */
	delayClassName: string;
	/** An object-position class that picks the crop. */
	imageClassName?: string;
};

/** Three nested layers: the slot moves on the scrub, the middle one drifts, PhotoMask holds the image. */
export function OrbitPhoto({
	photo,
	alt,
	slotClassName,
	delayClassName,
	imageClassName,
}: OrbitPhotoProps) {
	return (
		<div className={cn("lumia-orbit-photo", slotClassName)}>
			<div className={cn("lumia-enter", delayClassName)}>
				<div className="lumia-drift">
					{/* The first screen shows these photos, so the browser loads them at once. */}
					<PhotoMask
						photo={photo}
						alt={alt}
						isFloating
						isLazy={false}
						className="h-full"
						maskClassName="h-full rounded-[32px]"
						imageClassName={imageClassName}
					/>
				</div>
			</div>
		</div>
	);
}
