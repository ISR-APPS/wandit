// Section 06, the quote band: one sentence of a buyer on the seamless tone, beside the piece that she bought.
// LandingPage renders it. It reads QUOTE_PIECE of lib/pieces.ts and the "quote" group of messages.ts.
import { useT } from "~/shared/i18n";
import { QUOTE_PIECE } from "../lib/pieces";
import { KICKER, MONO, WRAP } from "../lib/type-styles";
import { PieceCaption } from "./piece-caption";
import { Plinth } from "./plinth";

/** The only band of the page with a ground that is not white. From 820px the plinth keeps a width of 236px. */
export function QuoteSection() {
	const { t } = useT();
	return (
		<section className="border-foreground/16 border-t bg-(--nour-seamless)">
			<div
				className={`${WRAP} grid items-end gap-[clamp(32px,4vw,52px)] py-[clamp(3.6rem,9vh,6.4rem)] min-[820px]:grid-cols-[minmax(0,1fr)_236px]`}
			>
				<figure data-reveal="">
					<div className="nour-fade">
						<p className={KICKER}>{t("quote.kicker")}</p>
						{/* The opening quote mark hangs before the text edge, so the words align with the kicker. */}
						{/* A phone gutter is 18px, so the mark hangs less there and stays clear of the screen edge. */}
						<blockquote className="mt-[18px] max-w-[27ch] indent-[-0.3em] font-display text-[clamp(1.5rem,3.5vw,2.9rem)] leading-[1.1] tracking-[-0.032em] min-[620px]:indent-[-0.42em]">
							{t("quote.text")}
						</blockquote>
						<figcaption className={`${MONO} mt-[22px]`}>
							{t("quote.cite")}
						</figcaption>
					</div>
				</figure>
				<div data-reveal="" className="w-full min-[820px]:max-w-[236px]">
					{/* Below 820px the plate and its label share one row, so no empty column sits under the quote. */}
					<div className="nour-fade grid grid-cols-[minmax(0,45%)_minmax(0,1fr)] items-end gap-4 min-[820px]:flex min-[820px]:flex-col min-[820px]:items-stretch min-[820px]:gap-[11px]">
						<Plinth piece={QUOTE_PIECE} isOnSeamless />
						<PieceCaption piece={QUOTE_PIECE} detail="full" />
					</div>
				</div>
			</div>
		</section>
	);
}
