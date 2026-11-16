// The one deep band of the page: one customer quote on the ink color, with one figure.
// LandingPage renders it between the comparison and the prices. It is never a carousel.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CHIP } from "../lib/class-names";

/** The band is the text color of the theme, so it stays the reverse of the page in dark mode. */
export function QuoteSection() {
	const { t } = useT();
	return (
		<section
			aria-label={t("quote.sectionLabel")}
			className="bg-foreground py-[clamp(3.5rem,8vh,5.5rem)] text-background"
		>
			<figure
				data-reveal
				className="mx-auto max-w-[calc(880px+2*var(--fw-pad))] px-(--fw-pad) text-center"
			>
				<blockquote className="text-balance font-display font-semibold text-[clamp(1.4rem,3vw,2.2rem)] leading-[1.35] tracking-[-0.01em]">
					{t("quote.text")}
				</blockquote>
				<figcaption className="mt-6 text-[0.95rem] text-background/72">
					<b className="font-bold font-display text-background">
						{t("quote.author")}
					</b>
					{" — "}
					{t("quote.shop")}
				</figcaption>
				<p className={cn(CHIP, "mt-5 bg-background/14 text-accent")}>
					{t("quote.chip")}
				</p>
			</figure>
		</section>
	);
}
