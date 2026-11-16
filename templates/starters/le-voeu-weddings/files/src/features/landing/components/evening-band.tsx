// The evening band: one full-bleed band with a rosewood panel and a candlelight photo.
// LandingPage renders it after the weddings. The panel holds one client quote in the display serif.
// The photo settles 6% with the scroll (data-scrub="pass"), and it carries the one caption plate of the page.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/type-styles";

/** The band: 0.42fr of ink panel and 0.58fr of photo. Below 900px the photo comes first.
 * On a wide screen the panel text starts on the axis of the 1280px page column, like the other sections. */
export function EveningBand() {
	const { t } = useT();
	return (
		<section
			aria-labelledby="evening-label"
			className="grid min-[900px]:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]"
		>
			<div className="flex flex-col justify-center bg-foreground px-[clamp(24px,4vw,66px)] py-[clamp(42px,5.4vw,80px)] text-background max-[899px]:order-2 max-[899px]:px-(--voeu-pad) min-[900px]:ps-[max(clamp(24px,4vw,66px),calc((100vw_-_1280px)/2_+_var(--voeu-pad)))]">
				<p
					id="evening-label"
					data-reveal="lift"
					className={cn(LABEL, "text-background/72")}
				>
					{t("evening.label")}
				</p>
				<blockquote
					data-reveal="lift"
					className="mt-[26px] text-pretty font-display text-[clamp(1.35rem,2.35vw,2.05rem)] leading-[1.34] tracking-[-0.003em]"
				>
					<p>“{t("evening.quote")}”</p>
				</blockquote>
				<p
					data-reveal="lift"
					className="mt-[26px] border-(--voeu-gold-line) border-t pt-[18px] font-bold text-[10.5px] text-background/74 uppercase leading-[1.6] tracking-[0.19em]"
				>
					{t("evening.attribution")}
				</p>
			</div>
			<figure
				data-scrub="pass"
				className="voeu-photo voeu-settle relative m-0 min-h-[clamp(240px,34vh,320px)] min-[900px]:min-h-[clamp(280px,44vh,540px)]"
			>
				<img
					src="/images/candles.webp"
					alt={t("evening.photoAlt")}
					width={1600}
					height={900}
					loading="lazy"
					decoding="async"
				/>
				{/* The one plate on a photo: inside the engraved rule, one line of capitals, no shadow. */}
				<figcaption className="absolute start-[13px] bottom-[13px] z-[2] max-w-[min(88%,420px)] border-(--voeu-gold-line) border-t bg-background px-5 pt-[13px] pb-3 font-bold text-[10px] text-foreground/72 uppercase leading-[1.6] tracking-[0.17em]">
					{t("evening.photoCaption")}
				</figcaption>
			</figure>
		</section>
	);
}
