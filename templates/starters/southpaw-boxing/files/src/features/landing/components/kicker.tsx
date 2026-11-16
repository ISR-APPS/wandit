// The small capital line above a round title: one phrase, or two phrases with a star between them.
// round-header.tsx renders it.
import { cn } from "~/shared/lib/utils";
import { Star } from "./star";

type KickerProps = {
	start: string;
	/** The phrase after the star. Without it, the kicker is one phrase and has no star. */
	end?: string;
	/** The memberships round uses a gold star. The other rounds use crimson. */
	isGoldStar?: boolean;
	className?: string;
};

/** A capital micro-label with wide tracking, in the dim ink. */
export function Kicker({
	start,
	end,
	isGoldStar = false,
	className,
}: KickerProps) {
	return (
		<p
			className={cn(
				"text-balance font-bold text-[0.72rem] text-muted-foreground uppercase leading-relaxed tracking-[0.32em]",
				className,
			)}
		>
			{start}
			{end !== undefined && (
				<>
					{/* Below 640px the second phrase takes its own line, so no line ends with a star. */}
					<Star
						className={cn(
							"sp-sep hidden sm:inline-block",
							isGoldStar ? "sp-gold" : "text-primary",
						)}
					/>
					<span className="block sm:inline">{end}</span>
				</>
			)}
		</p>
	);
}
