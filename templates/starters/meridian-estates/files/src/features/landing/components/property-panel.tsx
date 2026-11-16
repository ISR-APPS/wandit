// One house of the portfolio: the copy column (the outlined plate number, place, name, description,
// ruled specs, guide price) and the 4:5 photo plate with its figure caption.
// PortfolioSection renders one per entry of PORTFOLIO_HOUSES. The `isFlipped` panels put the plate first.
import { useT } from "~/shared/i18n";
import type { PortfolioHouse } from "../lib/content";
import { formatGuidePrice, formatWhole } from "../lib/format";
import { staggerStep } from "../lib/motion";

type PropertyPanelProps = {
	house: PortfolioHouse;
	/** True for every second panel. On a wide screen the plate comes first, and the grid columns mirror. */
	isFlipped: boolean;
};

/**
 * A full-width block on a phone. From md, a snap panel 66% of the screen wide; from xl, 58%.
 * At xl the lead panel and one house leave about 12% free, so the next plate shows at the edge.
 */
export function PropertyPanel({ house, isFlipped }: PropertyPanelProps) {
	const { t, locale } = useT();
	const specs = [
		{ value: String(house.bedrooms), label: t("portfolio.bedrooms") },
		{
			value: `${formatWhole(house.interiorM2, locale)} m²`,
			label: t("portfolio.interior"),
		},
		{ value: String(house.completedYear), label: t("portfolio.completed") },
	];
	return (
		<article
			id={house.id}
			aria-label={`${t(house.name)} ${t(house.accent)}`}
			className={`mer-gutter relative grid scroll-mt-20 content-start gap-8 border-foreground/8 border-b py-14 md:min-h-[min(88svh,50rem)] md:w-[66vw] md:content-center md:items-center md:gap-[clamp(2rem,3.5vw,4rem)] md:border-e md:border-b-0 md:py-[clamp(5rem,10vh,7rem)] xl:w-[58vw] ${isFlipped ? "md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : "md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"}`}
		>
			<div
				className={`relative z-[2] flex max-w-[34rem] flex-col gap-5 ${isFlipped ? "md:order-2" : ""}`}
			>
				<span
					aria-hidden="true"
					className="mer-outline -mb-2 hidden select-none font-display text-[clamp(5rem,8vw,8rem)] italic leading-none md:block"
				>
					{house.plate}
				</span>
				<p
					data-reveal
					className="mer-rise flex items-center gap-4 text-[0.6875rem] text-foreground/60 uppercase tracking-[0.22em]"
				>
					<span aria-hidden="true" className="h-px w-8 bg-primary" />
					{t(house.location)}
				</p>
				<h3
					data-reveal
					className={`mer-rise font-display text-[clamp(2.2rem,3.4vw,3.8rem)] leading-[1.04] tracking-[-0.01em] ${staggerStep(1)}`}
				>
					{t(house.name)}{" "}
					<em className="text-primary italic">{t(house.accent)}</em>
				</h3>
				<p
					data-reveal
					className={`mer-rise max-w-[38ch] text-[0.90625rem] text-foreground/70 leading-[1.8] ${staggerStep(2)}`}
				>
					{t(house.description)}
				</p>
				<dl
					data-reveal
					className={`mer-rise flex flex-wrap gap-x-[clamp(1.4rem,3vw,2.6rem)] gap-y-4 border-foreground/8 border-y py-5 ${staggerStep(3)}`}
				>
					{specs.map((spec) => (
						<div key={spec.label} className="flex flex-col-reverse gap-1">
							<dt className="text-[0.625rem] text-foreground/55 uppercase tracking-[0.2em]">
								{spec.label}
							</dt>
							<dd className="font-display text-[1.25rem] tabular-nums">
								{spec.value}
							</dd>
						</div>
					))}
				</dl>
				<p
					data-reveal
					className={`mer-rise flex items-baseline gap-5 ${staggerStep(4)}`}
				>
					<span className="font-display text-[clamp(1.7rem,2.6vw,2.5rem)] text-primary tabular-nums">
						{formatGuidePrice(house.guidePriceMillions, locale)}
					</span>
					<span className="text-[0.65625rem] text-foreground/55 uppercase tracking-[0.2em]">
						{t("portfolio.guidePrice")}
					</span>
				</p>
			</div>

			<figure
				className={`relative z-[2] -order-1 w-full md:w-[min(100%,560px)] ${isFlipped ? "md:order-1 md:justify-self-start" : "md:order-none md:justify-self-end"}`}
			>
				<div className="mer-swell">
					<div data-reveal className="mer-plate aspect-[4/5]">
						<img
							src={house.image}
							alt={t(house.alt)}
							width={1100}
							height={1366}
							loading="lazy"
							decoding="async"
							className="size-full object-cover"
							style={{ objectPosition: house.focus }}
						/>
					</div>
				</div>
				<figcaption className="mt-3.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[0.65625rem] text-foreground/55 uppercase tracking-[0.16em]">
					<span>{t(house.figure)}</span>
					<span className="tabular-nums">{t(house.coordinates)}</span>
				</figcaption>
			</figure>
		</article>
	);
}
