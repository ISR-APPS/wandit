// Movement 03, "Figures": the deep band, the showpiece of the page. LandingPage renders it edge to edge.
// Three pull-figures sit on full-width base rules. Each row counts up when the scroll brings it in (figure-row.tsx).
// The band inverts the ink. The index spine reads `data-deep-band` and inverts with it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PULL_FIGURES } from "../lib/content";
import { SECTION_TITLE } from "../lib/type-styles";
import { FigureRow } from "./figure-row";
import { SectionLabel } from "./section-label";

/** The three figures that carry the page. From 900px the band fills one screen, up to 864px on a tall screen. */
export function FiguresSection() {
	const { t } = useT();
	return (
		<section
			id="figures"
			data-movement
			data-deep-band
			className="cap-band scroll-mt-(--cap-bar) bg-foreground text-background"
		>
			<div className="cap-wrap flex flex-col justify-center py-[clamp(3.4rem,7vh,5rem)] min-[56.25rem]:min-h-[min(calc(100svh-var(--cap-bar)),54rem)]">
				<div
					data-reveal
					className="mb-[clamp(2rem,4vh,3rem)] grid grid-cols-1 gap-3.5 min-[56.25rem]:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] min-[56.25rem]:items-end min-[56.25rem]:gap-12"
				>
					<div>
						<SectionLabel className="mb-[1.4rem] text-(--cap-band-soft)">
							{t("figures.label")}
						</SectionLabel>
						<h2 className={cn(SECTION_TITLE, "max-w-[24ch]")}>
							{t("figures.title")}
						</h2>
					</div>
					<p className="text-(--cap-band-soft) text-sm">{t("figures.scope")}</p>
				</div>
				<div className="flex flex-col">
					{PULL_FIGURES.map((figure) => (
						<FigureRow key={figure.id} figure={figure} />
					))}
				</div>
			</div>
		</section>
	);
}
