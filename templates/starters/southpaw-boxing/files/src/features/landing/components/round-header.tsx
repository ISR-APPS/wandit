// The head of a round section: the stamp, the kicker, the two-tone title, and one line of copy.
// Each section component of the landing page renders it with its own texts.
import { cn } from "~/shared/lib/utils";
import { Kicker } from "./kicker";
import { Reveal } from "./reveal";
import { RoundStamp } from "./round-stamp";

type RoundHeaderProps = {
	/** The section number on the stamp, 1 to 7. */
	round: number;
	/** "start": stamp before the title. "flip": stamp at the far end. "center": stamp above a centered title. */
	layout: "start" | "flip" | "center";
	/** The id of the h2. The section points at it with aria-labelledby. */
	titleId: string;
	kickerStart: string;
	kickerEnd?: string;
	isGoldStar?: boolean;
	/** The first words of the title, in the ink color. */
	titleStart: string;
	/** The last words of the title, in hot crimson. */
	titleAccent: string;
	sub?: string;
};

/** One header for all seven rounds, so their rhythm stays the same down the page. */
export function RoundHeader({
	round,
	layout,
	titleId,
	kickerStart,
	kickerEnd,
	isGoldStar,
	titleStart,
	titleAccent,
	sub,
}: RoundHeaderProps) {
	const isCenter = layout === "center";
	return (
		<header
			className={cn(
				"mb-8 flex gap-5 md:mb-11 md:gap-7",
				isCenter && "flex-col items-center text-center",
				layout === "start" && "flex-col items-start md:flex-row md:items-end",
				layout === "flip" &&
					"flex-col items-start md:flex-row-reverse md:items-end md:justify-between",
			)}
		>
			<RoundStamp round={round} />
			<div className={cn("min-w-0", !isCenter && "md:flex-1")}>
				<Reveal>
					<Kicker
						start={kickerStart}
						end={kickerEnd}
						isGoldStar={isGoldStar}
						className="mb-2"
					/>
				</Reveal>
				<Reveal delayMs={60}>
					<h2
						id={titleId}
						className="font-display font-extrabold text-[clamp(3rem,7.4vw,5.75rem)] uppercase leading-[0.9] tracking-normal"
					>
						{titleStart} <span className="sp-hot">{titleAccent}</span>
					</h2>
				</Reveal>
				{sub !== undefined && (
					<Reveal delayMs={120}>
						<p
							className={cn(
								"mt-4 max-w-[56ch] text-pretty text-muted-foreground md:text-lg",
								isCenter && "mx-auto",
							)}
						>
							{sub}
						</p>
					</Reveal>
				)}
			</div>
		</header>
	);
}
