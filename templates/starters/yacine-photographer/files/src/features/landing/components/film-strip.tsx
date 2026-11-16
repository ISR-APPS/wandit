// The contact-sheet strip under the hero: a band of film base with sprocket holes and eight numbered frames.
// hero-section.tsx renders it. It reads STRIP_FRAMES from lib/content.ts.
// The rail scrolls sideways and the viewport edge cuts it, so the roll continues off the page.
import { useT } from "~/shared/i18n";
import { STRIP_FRAMES } from "../lib/content";
import { META } from "../lib/styles";
import { PhotoFrame } from "./photo-frame";

/** Full-bleed strip. Its first frame lines up with the page container. */
export function FilmStrip() {
	const { t } = useT();
	return (
		<div className="yr-band-x relative border-foreground/15 border-y bg-canvas py-[21px]">
			<section
				aria-label={t("strip.label")}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll area must take focus so the arrow keys can scroll it.
				tabIndex={0}
				className="yr-rail flex gap-[5px] overflow-x-auto overflow-y-hidden"
			>
				<p
					className={`${META} shrink-0 self-center whitespace-nowrap pe-[18px] leading-[1.6] sm:pe-7`}
				>
					{t("strip.lead1")}
					<br />
					{t("strip.lead2")}
					<br />
					{t("strip.lead3")}
				</p>
				{STRIP_FRAMES.map((frame) => (
					<PhotoFrame
						key={frame.number}
						photo={frame.photo}
						number={frame.number}
						numberPlace="base"
						exif="short"
						className="aspect-[3/2] w-[clamp(126px,14.4vw,196px)] shrink-0"
					/>
				))}
			</section>
		</div>
	);
}
