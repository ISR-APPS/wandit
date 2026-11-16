// The round plate of a title belt: two rings and a star, in the metal of the membership.
// belt-card.tsx renders it.
import { cn } from "~/shared/lib/utils";
import type { BeltId } from "../lib/content";

/** The ring and star classes of each belt: pewter, cream with a crimson star, and gold. */
const PLATE_CLASS: Record<
	BeltId,
	{ ring: string; inner: string; star: string }
> = {
	contender: {
		ring: "stroke-muted-foreground",
		inner: "stroke-muted-foreground/70",
		star: "fill-muted-foreground",
	},
	mainEventer: {
		ring: "stroke-foreground",
		inner: "stroke-muted-foreground",
		star: "fill-primary",
	},
	champion: {
		ring: "stroke-(color:--sp-gold)",
		inner: "stroke-(color:--sp-gold-dim)",
		star: "fill-(--sp-gold)",
	},
};

/** A decorative plate. The champion plate is a little larger, like its star. */
export function BeltPlate({ belt }: { belt: BeltId }) {
	const classes = PLATE_CLASS[belt];
	const isChampion = belt === "champion";
	return (
		<svg
			viewBox="0 0 120 120"
			aria-hidden="true"
			focusable="false"
			className="sp-belt-plate size-full"
		>
			<circle
				cx="60"
				cy="60"
				r={isChampion ? 48 : 46}
				strokeWidth={isChampion ? 5 : 4}
				className={cn("fill-(--sp-surface)", classes.ring)}
			/>
			<circle
				cx="60"
				cy="60"
				r={isChampion ? 36 : 34}
				fill="none"
				strokeWidth="2"
				className={classes.inner}
			/>
			<path
				d={
					isChampion
						? "M60 36l7 16.8 17.9 1.5-13.7 11.7 4.3 17.4L60 74l-15.5 9.4 4.3-17.4-13.7-11.7 17.9-1.5z"
						: "M60 40l5.8 13.9 14.8 1.2-11.4 9.7 3.6 14.4L60 71.4l-12.8 7.8 3.6-14.4-11.4-9.7 14.8-1.2z"
				}
				className={classes.star}
			/>
		</svg>
	);
}
