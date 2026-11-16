// The headliner paste-up: the showpiece of the page. Four headliner posters paste over each other while the page scrolls.
// LandingPage renders it after the manifesto. The final frame is an index of three pasted edges and the last poster.
// The motion is CSS position: sticky only, so it needs no script. The hold under the posters sends to the programme.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { HEADLINERS } from "../lib/content";
import { BUTTON, GUTTER, SHEET } from "../lib/type-styles";
import { HeadlinerPoster } from "./headliner-poster";

/** The ground of the hold space: the ground of the last poster, so the hold reads as part of it. */
const LAST_GROUND = HEADLINERS[HEADLINERS.length - 1]?.ground ?? "cream";

/** The posters stay inside this section, so they all scroll away together after the last one lands. */
export function HeadlinersSection() {
	const { t } = useT();
	return (
		<section
			id="headliners"
			aria-labelledby="headliners-title"
			className="relative"
		>
			<h2 id="headliners-title" className="sr-only">
				{t("headliners.title")}
			</h2>
			{HEADLINERS.map((headliner, index) => (
				<HeadlinerPoster
					key={headliner.id}
					headliner={headliner}
					index={index}
				/>
			))}
			{/* The hold: the last poster covers this space while it passes, so the final index stays still for a moment.
			    It is not positioned, so the sticky poster paints over it. It shows only when the posters scroll away. */}
			<div
				className={cn(
					SHEET[LAST_GROUND],
					GUTTER,
					"flex min-h-[35svh] flex-col justify-center pb-[clamp(2.5rem,6vh,4rem)]",
				)}
			>
				<div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-current border-t-2 pt-6">
					<div>
						<p className="font-display text-[clamp(2.6rem,6vw,5.6rem)] uppercase leading-[0.9] tracking-[0.01em]">
							{t("headliners.moreBands")}
						</p>
						<p className="mt-3 max-w-[30em] text-pretty text-[clamp(1rem,1.3vw,1.15rem)]">
							{t("headliners.moreBandsBody")}
						</p>
					</div>
					<a href="#programme" className={cn(BUTTON, "shrink-0")}>
						{t("headliners.moreBandsLink")}
					</a>
				</div>
			</div>
		</section>
	);
}
