// Section 01: the three open series of the photographer.
// landing-page.tsx renders it. It reads SERIES from lib/content.ts and the "series" group of messages.ts.
// The cards sit at three heights: vertical offsets are how this page breathes.
import { useT } from "~/shared/i18n";
import { SERIES } from "../lib/content";
import { H2, KICKER, META, NOTE, WRAP } from "../lib/styles";
import { CutGroup } from "./cut-group";
import { SeriesCard } from "./series-card";

/** The section ends on a mono foot: two facts and one link, in place of empty air. */
export function SeriesSection() {
	const { t } = useT();
	return (
		<section
			id="series"
			aria-labelledby="series-title"
			className="pt-(--yr-section) pb-(--yr-section-tight)"
		>
			<div className={WRAP}>
				<CutGroup className="grid items-end gap-[18px] pb-[clamp(2rem,4vh,3.2rem)] min-[861px]:grid-cols-[minmax(0,1fr)_minmax(0,clamp(220px,26vw,360px))]">
					<div className="yr-cut">
						<p className={KICKER}>{t("series.kicker")}</p>
						<h2 id="series-title" className={`${H2} mt-3.5`}>
							<span className="block">{t("series.titleLine1")}</span>
							<span className="block">{t("series.titleLine2")}</span>
						</h2>
					</div>
					<p
						className={`${NOTE} yr-cut max-w-[60ch] [--cut:1] min-[861px]:text-end`}
					>
						{t("series.note")}
					</p>
				</CutGroup>

				<CutGroup className="grid gap-x-3.5 gap-y-4 min-[471px]:grid-cols-2 min-[821px]:grid-cols-3 min-[821px]:gap-[clamp(16px,2.4vw,34px)]">
					{SERIES.map((series) => (
						<SeriesCard key={series.number} series={series} />
					))}
				</CutGroup>

				<CutGroup
					as="p"
					className={`${META} mt-[clamp(2rem,4vh,3.2rem)] flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-foreground/15 border-t pt-2`}
				>
					<span className="yr-cut">{t("series.footFacts")}</span>
					{/* The link is 44px high for a thumb. Only the text inside it inverts on hover. */}
					<a
						href="#contact"
						className="yr-cut group inline-flex min-h-11 items-center text-foreground [--cut:1]"
					>
						<span className="border-foreground/30 border-b pb-0.5 group-hover:border-foreground group-hover:bg-foreground group-hover:text-background group-focus-visible:border-foreground group-focus-visible:bg-foreground group-focus-visible:text-background">
							{t("series.footLink")}{" "}
							<span
								aria-hidden="true"
								className="inline-block rtl:-scale-x-100"
							>
								→
							</span>
						</span>
					</a>
				</CutGroup>
			</div>
		</section>
	);
}
