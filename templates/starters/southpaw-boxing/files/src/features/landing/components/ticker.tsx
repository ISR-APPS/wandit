// The marquee strip under the poster: six club facts that loop from end to start.
// hero-poster.tsx renders it. landing.css moves the track; it stops under reduced motion.
import { useT } from "~/shared/i18n";
import { TICKER_ITEMS } from "../lib/content";
import { Star } from "./star";

/** The two copies of the track make the loop seamless. Screen readers skip the strip: the page states each fact elsewhere. */
export function Ticker() {
	const { t } = useT();
	return (
		<div aria-hidden="true" className="sp-ticker mt-8 overflow-clip md:mt-10">
			<div className="sp-ticker-track flex w-max">
				{["first", "second"].map((copy) => (
					<div
						key={copy}
						className="flex items-center whitespace-nowrap py-3 font-display font-extrabold text-lg text-muted-foreground uppercase leading-none tracking-[0.2em]"
					>
						{TICKER_ITEMS.map((item) => (
							<span key={item} className="flex items-center">
								{t(item)}
								<Star className="mx-5 text-primary text-sm" />
							</span>
						))}
					</div>
				))}
			</div>
		</div>
	);
}
