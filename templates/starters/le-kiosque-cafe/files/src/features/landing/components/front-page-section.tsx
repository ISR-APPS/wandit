// La une, the front page: kicker, lead headline, deck, byline, and a justified ruled lede against the shopfront plate.
// LandingPage renders it under the masthead. The service box beside the plate gives the day at the counter.
// It is on the first screen, so its press roll is the CSS load animation of kiosque.css, not a scroll reveal.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	BYLINE,
	DATELINE,
	DECK,
	HEADLINE,
	JUMP,
	KICKER,
	PROSE_LINK,
} from "../lib/type-styles";
import { PressPlate } from "./press-plate";
import { Slug } from "./slug";
import { StorefrontPlate } from "./storefront-plate";

/** The front page grid: the story on the start side, the plate and the service box on the end side. */
export function FrontPageSection() {
	const { t } = useT();
	return (
		<section
			id="front-page"
			aria-labelledby="front-headline"
			className="ks-wrap pt-[clamp(2.2rem,5vh,3.6rem)] pb-[clamp(2.5rem,6vh,4rem)]"
		>
			<div className="grid gap-[clamp(1.8rem,3.5vw,3rem)] min-[980px]:grid-cols-[1.55fr_1fr]">
				<article>
					<p className={cn(KICKER, "ks-load-rise mb-3 [--ks-delay:450ms]")}>
						{t("front.kicker")}
					</p>
					<h2
						id="front-headline"
						className={cn(HEADLINE, "ks-load-rise [--ks-delay:520ms]")}
					>
						{t("front.headline")}
					</h2>
					<p className={cn(DECK, "ks-load-rise mt-3 [--ks-delay:600ms]")}>
						{t("front.deck")}
					</p>
					<p className={cn(BYLINE, "ks-load-rise mt-4 [--ks-delay:660ms]")}>
						{t("front.byline")}
					</p>
					<div className="ks-cols ks-load-rise mt-5 [--ks-delay:720ms]">
						<p>
							<span className={DATELINE}>{t("front.dateline")}</span>{" "}
							{t("front.body1")}
						</p>
						<p>{t("front.body2")}</p>
						<p>
							{t("front.body3Lead")}{" "}
							<a href="#letters" className={PROSE_LINK}>
								{t("front.body3Link")}
							</a>
							.
						</p>
					</div>
					<p className="ks-load-rise mt-2 text-end [--ks-delay:800ms]">
						<a href="#roast" className={JUMP}>
							{t("front.jump")}
						</a>
					</p>
				</article>
				<div className="grid content-start items-start gap-8 border-(--ks-rule) border-t pt-8 min-[640px]:grid-cols-2 min-[980px]:grid-cols-1 min-[980px]:border-s min-[980px]:border-t-0 min-[980px]:ps-[clamp(1.4rem,2.5vw,2.4rem)] min-[980px]:pt-0">
					<PressPlate
						captionKey="front.caption"
						className="ks-load-rise [--ks-delay:600ms]"
					>
						<StorefrontPlate />
					</PressPlate>
					<aside
						aria-label={t("front.serviceTitle")}
						className="ks-load-rise border border-(--ks-rule-strong) bg-canvas px-5 py-4.5 [--ks-delay:760ms]"
					>
						<Slug className="mb-2.5">{t("front.serviceTitle")}</Slug>
						<p className="text-[0.95rem] leading-[1.55]">
							{t("front.serviceBody")}
						</p>
					</aside>
				</div>
			</div>
		</section>
	);
}
