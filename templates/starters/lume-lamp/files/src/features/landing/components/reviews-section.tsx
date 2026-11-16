// Three short reviews from the first owners, in serif italic, with a brass star row and a name line.
// LandingPage renders it after the object record, with no top padding, so the two read as one chapter.
// The "Reviews" link of the header jumps here. The names and the quotes are fictional samples.
import { useT } from "~/shared/i18n";
import { WRAP } from "../lib/type-styles";
import { SectionHead } from "./section-head";

/** Three columns from 1024px, with a hairline in the middle of each gutter. One column below. */
export function ReviewsSection() {
	const { t } = useT();
	const reviews = [
		{
			quote: t("reviews.review1"),
			name: t("reviews.review1Name"),
			place: t("reviews.review1Place"),
		},
		{
			quote: t("reviews.review2"),
			name: t("reviews.review2Name"),
			place: t("reviews.review2Place"),
		},
		{
			quote: t("reviews.review3"),
			name: t("reviews.review3Name"),
			place: t("reviews.review3Place"),
		},
	];
	return (
		<section
			id="reviews"
			aria-labelledby="reviews-title"
			className="scroll-mt-[4.5rem] pb-[clamp(5rem,11vh,8.5rem)]"
		>
			<div className={WRAP}>
				<SectionHead
					kicker={t("reviews.kicker")}
					title={t("reviews.title")}
					turn={t("reviews.titleTurn")}
					titleId="reviews-title"
					className="mb-[clamp(2.6rem,6vw,4.5rem)]"
				/>
				<div className="grid max-w-[40rem] gap-12 lg:max-w-none lg:grid-cols-3 lg:gap-[clamp(2rem,4vw,4rem)]">
					{reviews.map((review) => (
						<figure
							key={review.name}
							data-reveal
							className="lume-review relative pt-[1.8rem]"
						>
							<span
								aria-hidden="true"
								className="lume-serif lume-quote-glyph absolute -top-[1.3rem] text-[4.6rem] text-primary leading-none opacity-50"
							>
								“
							</span>
							<blockquote>
								<p className="lume-serif text-[clamp(1.12rem,1.5vw,1.3rem)] leading-[1.5]">
									{review.quote}
								</p>
							</blockquote>
							<p className="mt-[1.1rem] mb-[0.45rem] text-[0.8rem] text-primary tracking-[0.28em]">
								<span aria-hidden="true">★★★★★</span>
								<span className="sr-only">{t("reviews.rating")}</span>
							</p>
							<figcaption className="text-[0.82rem] text-foreground/52 uppercase tracking-[0.12em]">
								<b className="font-medium text-foreground">{review.name}</b>
								{" — "}
								{review.place}
							</figcaption>
						</figure>
					))}
				</div>
			</div>
		</section>
	);
}
