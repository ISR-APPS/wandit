// The exhale marquee between the booking band and the footer: "breathe in · breathe out · begin again".
// LandingPage renders it. The track holds the three words four times, so the half-width loop of landing.css never shows a gap.
// It is decorative: the words repeat the voice of the page and carry no fact.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

/** Four copies of the three words. Each copy has a stable key. */
const COPIES = ["a", "b", "c", "d"] as const;

/** The strip. Every third word is clay. With reduced motion the track stands still. */
export function ExhaleStrip() {
	const { t } = useT();
	const words = [
		t("exhale.breatheIn"),
		t("exhale.breatheOut"),
		t("exhale.beginAgain"),
	];
	return (
		<div
			aria-hidden="true"
			className="overflow-hidden border-(--sp-line-soft) border-t py-[clamp(40px,6vw,72px)]"
		>
			<div className="sp-marquee inline-flex whitespace-nowrap">
				{COPIES.map((copy) =>
					words.map((word, index) => (
						<span
							key={`${copy}-${word}`}
							className={cn(
								"pe-[1.2em] font-display text-[clamp(2.4rem,6vw,4.6rem)] italic",
								index === 2 ? "text-(--sp-terra)/30" : "text-foreground/20",
							)}
						>
							{word}
						</span>
					)),
				)}
			</div>
		</div>
	);
}
