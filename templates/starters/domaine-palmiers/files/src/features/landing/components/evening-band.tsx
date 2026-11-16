// The evening band: one photo across the page with one buyer quote on an ivory plate.
// LandingPage renders it between the visit and the specification. It is the only social proof of the page.
// The plate sits on the bottom corner of the photo and hangs onto the ground below.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CAPTION, WRAP } from "../lib/type-styles";
import { Aperture } from "./aperture";

/** The photo has no reference strip, so its bottom edge is free for the plate. */
export function EveningBand() {
	const { t } = useT();
	return (
		<section
			aria-label={t("evening.sectionLabel")}
			className="relative pb-[clamp(5rem,9vw,8.5rem)]"
		>
			<Aperture
				src="/images/coast.webp"
				alt={t("evening.imageAlt")}
				width={1600}
				height={900}
				className="aspect-[4/5] max-h-[80vh] border-x-0 sm:aspect-[4/3] md:aspect-[2.35/1]"
			/>
			{/* The plate sits in the page column, so its edge is on the edge of the text of the other sections.
			    It stops above the end of the section, so its frame never sits on the change of ground. */}
			<div className="absolute inset-x-0 bottom-[clamp(2rem,3.5vw,3rem)] z-3">
				<div className={WRAP}>
					<figure
						data-reveal="lift"
						className="max-w-[560px] border border-foreground/24 bg-background p-[clamp(1.4rem,2.6vw,2.3rem)]"
					>
						<blockquote className="font-display text-[clamp(1.05rem,1.6vw,1.42rem)] leading-[1.4]">
							{t("evening.quote")}
						</blockquote>
						<figcaption
							className={cn(
								CAPTION,
								"mt-[1.1rem] border-foreground/12 border-t pt-[0.85rem] text-[0.85rem]",
							)}
						>
							{t("evening.cite")}
						</figcaption>
					</figure>
				</div>
			</div>
		</section>
	);
}
