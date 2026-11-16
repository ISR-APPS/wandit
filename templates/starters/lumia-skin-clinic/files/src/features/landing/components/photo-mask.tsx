// A photograph of the home page in its deep-rounded mask (28px to 48px), with the hover lift of the world.
// OrbitPhoto and the care, ritual, window, doctor, and contact sections render it. landing.css draws the mask (.lumia-mask).
// Every photo of the page goes through this component, so no photo can lose its rounded corners.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import type { Photo } from "../lib/photos";

type PhotoMaskProps = {
	/** The file and its pixel size, from PHOTOS. */
	photo: Photo;
	/** Translated description of the photo. */
	alt: string;
	/** Radius and height of the mask, for example "h-[24rem] rounded-[36px]". */
	maskClassName: string;
	/** Classes of the <figure>. */
	className?: string;
	/** Classes of the <img>, for example an object-position that picks the crop. */
	imageClassName?: string;
	/** True for a photo that floats on the ground. It casts the one warm shadow of the world. */
	isFloating?: boolean;
	/** False only for a photo of the first screen. Below the fold the browser loads the image when it comes near. */
	isLazy?: boolean;
	/** Something that sits on the mask edge, such as a caption capsule. The mask does not clip it. */
	children?: ReactNode;
};

/** A <figure> with the masked image. The figure lifts 4px on hover, focus, and touch. */
export function PhotoMask({
	photo,
	alt,
	maskClassName,
	className,
	imageClassName,
	isFloating = false,
	isLazy = true,
	children,
}: PhotoMaskProps) {
	return (
		<figure className={cn("lumia-photo relative m-0 min-w-0", className)}>
			<div
				className={cn(
					"lumia-mask",
					isFloating && "lumia-floating",
					maskClassName,
				)}
			>
				<img
					src={photo.src}
					alt={alt}
					width={photo.width}
					height={photo.height}
					loading={isLazy ? "lazy" : "eager"}
					decoding="async"
					className={imageClassName}
				/>
			</div>
			{children}
		</figure>
	);
}
