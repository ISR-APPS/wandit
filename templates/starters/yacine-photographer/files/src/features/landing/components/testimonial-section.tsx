// The client quote: one static sentence in display type, with a vertical strip of three frames beside it.
// landing-page.tsx renders it between the About and the Prints sections.
// It reads QUOTE_STRIP from lib/content.ts and the "testimonial" group of messages.ts.
import { useT } from "~/shared/i18n";
import { QUOTE_STRIP } from "../lib/content";
import { KICKER, META, WRAP } from "../lib/styles";
import { CutGroup } from "./cut-group";
import { PhotoFrame } from "./photo-frame";

/**
 * One quote, never a carousel. Below 820px the strip turns to a horizontal band of three frames.
 * The quote sits on the base of the strip, so its rule and the strip end on one line.
 */
export function TestimonialSection() {
	const { t } = useT();
	return (
		<section
			aria-labelledby="testimonial-title"
			className="py-[clamp(3.4rem,7vh,5.6rem)]"
		>
			<CutGroup
				className={`${WRAP} grid items-end gap-[clamp(24px,4vw,64px)] min-[820px]:grid-cols-[minmax(0,1fr)_clamp(140px,15vw,196px)]`}
			>
				<div>
					<p id="testimonial-title" className={`${KICKER} yr-cut`}>
						{t("testimonial.kicker")}
					</p>
					<blockquote className="yr-cut mt-[22px] max-w-[27ch] font-display font-semibold text-[clamp(1.5rem,3.5vw,2.95rem)] leading-[1.12] tracking-[-0.022em] [--cut:1]">
						{t("testimonial.quote")}
					</blockquote>
					<p
						className={`${META} yr-cut mt-[clamp(1.8rem,3.4vh,2.8rem)] flex flex-wrap justify-between gap-x-6 gap-y-2 border-foreground/15 border-t pt-3.5 [--cut:2]`}
					>
						<span>{t("testimonial.author")}</span>
						<span>{t("testimonial.rolls")}</span>
					</p>
				</div>

				<div className="yr-quote-strip yr-cut relative grid max-w-[420px] grid-cols-3 gap-[5px] border border-foreground/15 bg-canvas px-3 py-5 [--cut:3] min-[820px]:max-w-none min-[820px]:grid-cols-1 min-[820px]:px-[18px] min-[820px]:py-3">
					{QUOTE_STRIP.map((photo) => (
						<PhotoFrame
							key={photo}
							photo={photo}
							exif="short"
							// From 820px the frames take the 3:2 of a 35 mm negative, so the strip is not much taller than the quote.
							className="aspect-square min-[820px]:aspect-[3/2]"
						/>
					))}
					<p className="yr-mono col-span-full pt-1 text-[0.6rem] text-primary uppercase leading-normal tracking-[0.1em]">
						{t("testimonial.stripCaption")}
					</p>
				</div>
			</CutGroup>
		</section>
	);
}
