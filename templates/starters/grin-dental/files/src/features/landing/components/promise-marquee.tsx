// Two tilted bands of scrolling words under the hero: an ink band with the promises, a coral band with the habits.
// LandingPage renders it. Each track holds its words twice, so a CSS loop of half its width has no seam.
// With reduced motion the bands stand still and the first copy of the words shows.
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";
import { MarqueeCopy } from "./marquee-copy";

const PROMISES: readonly TranslationKey[] = [
	"marquee.noDrills",
	"marquee.gentle",
	"marquee.stickers",
	"marquee.saturdays",
	"marquee.parents",
	"marquee.patrol",
];

/** The three habits of the coral band. The band is short, so it shows four copies of them. */
const HABITS: readonly TranslationKey[] = [
	"marquee.brush",
	"marquee.floss",
	"marquee.highFives",
];

const HABIT_COPIES = ["first", "second", "third", "fourth"] as const;

/** The band pair, about 170px high. It bleeds 5% past each side so the tilt never shows a corner. */
export function PromiseMarquee() {
	const { t } = useT();
	return (
		<section
			aria-label={t("marquee.label")}
			className="relative isolate overflow-clip pt-13 pb-14"
		>
			<div className="gd-on-dark relative -start-[5%] w-[110%] -rotate-[1.6deg] overflow-clip border-foreground border-y-[length:var(--gd-line)] bg-foreground py-3 text-background">
				<div className="gd-marquee-track flex w-max">
					<MarqueeCopy
						words={PROMISES}
						isDuplicate={false}
						starClass="text-(--gd-sun)"
						textClass="text-[clamp(1.15rem,2vw,1.5rem)]"
					/>
					<MarqueeCopy
						words={PROMISES}
						isDuplicate
						starClass="text-(--gd-sun)"
						textClass="text-[clamp(1.15rem,2vw,1.5rem)]"
					/>
				</div>
			</div>
			<div
				aria-hidden="true"
				className="relative -start-[5%] -z-10 -mt-2.5 w-[110%] rotate-[1.2deg] overflow-clip border-foreground border-y-[length:var(--gd-line)] bg-primary py-2 text-primary-foreground"
			>
				<div className="gd-marquee-track-reverse flex w-max">
					{/* Four copies: the loop moves half the track, so each half holds two. */}
					{HABIT_COPIES.map((copy) => (
						<MarqueeCopy
							key={copy}
							words={HABITS}
							isDuplicate
							starClass="text-foreground"
							textClass="text-[1.05rem]"
						/>
					))}
				</div>
			</div>
		</section>
	);
}
