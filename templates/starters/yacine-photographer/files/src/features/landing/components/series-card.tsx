// One series: its cover photograph, a title rule with the years, and two lines of prose.
// series-section.tsx renders three of them at staggered heights.
// It reads one Series of lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { Series } from "../lib/content";
import { META, PROSE } from "../lib/styles";
import { PhotoFrame } from "./photo-frame";

type SeriesCardProps = {
	series: Series;
};

/** A photograph with a rule under it. No box and no shadow: nothing floats in this world. Its place comes from the Series row. */
export function SeriesCard({ series }: SeriesCardProps) {
	const { t } = useT();
	return (
		<article className={cn("yr-cut", series.place)}>
			<PhotoFrame
				photo={series.photo}
				number={series.number}
				exif="full"
				className={series.ratio}
			/>
			<div className="mt-3.5 flex items-baseline justify-between gap-3.5 border-foreground/15 border-t pt-3">
				<h3 className="font-bold font-display text-[clamp(1.16rem,1.55vw,1.5rem)] leading-[1.12] tracking-[-0.02em]">
					{t(series.titleKey)}
				</h3>
				<span className={`${META} whitespace-nowrap`}>
					{t(series.yearsKey)}
				</span>
			</div>
			<p className={`${PROSE} mt-2.5 max-w-[34ch] text-[0.98rem]`}>
				{t(series.bodyKey)}
			</p>
		</article>
	);
}
