// The score of a candidate as five stars, from the last interviewer. The candidate table and the candidate dialog show it.
import { StarIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

// The scale of the score: 1 to 5.
const STARS = [1, 2, 3, 4, 5] as const;

type RatingStarsProps = {
	/** The score, 1 to 5. */
	rating: number;
};

/** Five stars; the first `rating` ones are filled. The group has one text label for screen readers. */
export function RatingStars({ rating }: RatingStarsProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<span
			role="img"
			aria-label={`${t("hiring.rating")} ${number.format(rating)} / ${number.format(STARS.length)}`}
			className="inline-flex items-center gap-0.5"
		>
			{STARS.map((star) => (
				<StarIcon
					key={star}
					weight={star <= rating ? "fill" : undefined}
					className={cn(
						"size-3.5",
						star <= rating ? "text-primary" : "text-muted-foreground/50",
					)}
				/>
			))}
		</span>
	);
}
