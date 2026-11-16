// The reviews: a scattered wall of six speech bubbles, white, one sun bubble with a kid's quote, one teal bubble.
// LandingPage renders it after the prices. The quotes come from REVIEWS in lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { REVIEWS } from "../lib/content";
import { DISPLAY, SECTION_TITLE, TAG, WRAP } from "../lib/styles";

/** The tilt and the vertical offset of each bubble, in wall order. The offsets apply from 640px only. */
const BUBBLE_PLACES = [
	"[--gd-r:-1.6deg]",
	"[--gd-r:1.2deg] sm:mt-9",
	"[--gd-r:-1deg] lg:mt-3",
	"[--gd-r:1.4deg]",
	"[--gd-r:-1.8deg] lg:-mt-5",
	"[--gd-r:1deg]",
] as const;

/** Three columns from 1024px, two from 640px, one on a phone. */
export function ReviewsSection() {
	const { t } = useT();
	return (
		<section
			id="reviews"
			aria-labelledby="reviews-title"
			className="relative scroll-mt-24 overflow-clip pt-[clamp(3.5rem,7vw,6rem)] pb-[clamp(4.5rem,7vw,6.5rem)]"
		>
			<div className={WRAP}>
				<div
					data-pop="self"
					className="mx-auto mb-[clamp(2.6rem,4.5vw,3.8rem)] max-w-[840px] text-center"
				>
					<p className={cn(TAG, "mb-4 -rotate-[2.5deg] bg-(--gd-sun)")}>
						{t("reviews.tag")}
					</p>
					<h2
						id="reviews-title"
						className={cn(
							SECTION_TITLE,
							"text-[clamp(2.5rem,5.8vw,4.8rem)] leading-[1] tracking-[-0.022em]",
						)}
					>
						{t("reviews.title")}
					</h2>
				</div>
				<div
					data-pop="kids"
					className="grid items-start gap-x-[clamp(1.6rem,3vw,2.4rem)] gap-y-[clamp(2.2rem,3.4vw,2.8rem)] sm:grid-cols-2 lg:grid-cols-3"
				>
					{REVIEWS.map((review, index) => (
						<figure
							key={review.quoteKey}
							className={cn(
								"gd-outline gd-shadow-6 gd-bubble gd-tilt gd-lift relative rounded-[calc(var(--radius)*1.5)] px-6 pt-6 pb-5.5",
								BUBBLE_PLACES[index],
								review.tone === "white" && "bg-card",
								review.tone === "kid" && "bg-(--gd-sun)",
								review.tone === "teal" &&
									"gd-on-dark bg-(--gd-teal) text-background",
							)}
						>
							{review.tone !== "kid" && (
								<>
									<p
										aria-hidden="true"
										className={cn(
											"mb-2 text-[1.05rem] tracking-[0.12em]",
											review.tone === "teal"
												? "text-(--gd-sun)"
												: "text-primary",
										)}
									>
										★★★★★
									</p>
									<span className="sr-only">{t("reviews.rated")}</span>
								</>
							)}
							<blockquote>
								<p
									className={cn(
										review.tone === "kid"
											? cn(DISPLAY, "text-[1.4rem] leading-[1.22]")
											: "font-bold text-[1.02rem] leading-relaxed",
									)}
								>
									{t(review.quoteKey)}
								</p>
							</blockquote>
							<figcaption
								className={cn(
									"mt-3 font-bold font-display text-[0.9rem]",
									review.tone === "white" && "text-(--gd-teal)",
									review.tone === "teal" && "text-background",
								)}
							>
								{t(review.authorKey)}
							</figcaption>
						</figure>
					))}
				</div>
			</div>
		</section>
	);
}
