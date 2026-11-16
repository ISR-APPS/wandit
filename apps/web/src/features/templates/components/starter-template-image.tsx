/**
 * One image of a starter template in its 16:10 stage: the cover or a gallery shot.
 * A neutral block with an icon shows when the file does not load.
 * starter-template-card.tsx and pages/template-detail-page.tsx render it.
 */
import { LayoutIcon } from "@phosphor-icons/react/Layout";
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";

import type { StarterTemplate } from "../api/dto";

type StarterTemplateImageProps = {
	/** URL of a 1280 x 800 px WebP file under `/starter-templates/<id>/`, from lib/helpers.ts. */
	src: string;
	/** Text for screen readers. Empty when the name of the starter template is next to the image. */
	alt: string;
	/** Light or dark base of the starter template, from the catalog. It sets the ground behind the image. */
	mode: StarterTemplate["mode"];
	/** `lazy` loads the file only near the viewport. The first image of the detail page uses `eager`. */
	loading: "lazy" | "eager";
};

/** The stage keeps its 16:10 box before the file loads, so the layout does not move. */
export function StarterTemplateImage({
	src,
	alt,
	mode,
	loading,
}: StarterTemplateImageProps) {
	// The URL of the file that failed. Another URL in the same stage gets a new try.
	const [failedSrc, setFailedSrc] = useState<string | null>(null);

	return (
		<div
			className={cn(
				"relative aspect-[16/10] overflow-hidden rounded-[1.375rem]",
				// A dark starter template loads on night, so its stage does not flash white.
				mode === "dark" ? "bg-night" : "bg-night/[0.04] dark:bg-white/[0.04]",
				// A hairline over the image: a white cover keeps its edge on the white card.
				"after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-night/[0.06] after:ring-inset dark:after:ring-white/10",
			)}
		>
			{failedSrc === src ? (
				<span aria-hidden className="grid size-full place-items-center">
					<LayoutIcon
						weight="duotone"
						className={cn(
							"size-7",
							mode === "dark"
								? "text-white/40"
								: "text-night/35 dark:text-foreground/40",
						)}
					/>
				</span>
			) : (
				<img
					key={src}
					src={src}
					alt={alt}
					loading={loading}
					decoding="async"
					onError={() => setFailedSrc(src)}
					className="block size-full object-cover object-top"
				/>
			)}
		</div>
	);
}
