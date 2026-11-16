// The prices: a peach band between two scallops, with the price menu card and the "no mystery fees" copy.
// LandingPage renders it after the team. From 1024px the menu sits at the start and the copy at the end;
// the copy comes first in the reading order, so the title is read before the menu.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BUTTON, DISPLAY, TAG, WRAP } from "../lib/styles";
import { PriceMenuCard } from "./price-menu-card";
import { ScallopEdge } from "./scallop-edge";

/** Two columns from 1024px, one column with the copy on top below. */
export function PricesSection() {
	const { t } = useT();
	return (
		<>
			<ScallopEdge fillClass="fill-(--gd-peach)" />
			<section
				id="prices"
				aria-labelledby="prices-title"
				className="relative scroll-mt-24 bg-(--gd-peach) py-[clamp(3.5rem,7vw,6rem)]"
			>
				<div
					className={cn(
						WRAP,
						"grid items-center gap-[clamp(2.5rem,5vw,4.5rem)] lg:grid-cols-[1.05fr_0.95fr]",
					)}
				>
					<div data-pop="self" className="lg:order-2">
						<p className={cn(TAG, "mb-4 rotate-[1.5deg] bg-card")}>
							{t("prices.tag")}
						</p>
						<h2
							id="prices-title"
							className={cn(
								DISPLAY,
								"mb-4.5 text-balance text-[clamp(2.1rem,4vw,3.4rem)] leading-[1.02]",
							)}
						>
							{t("prices.title")}
						</h2>
						<p className="mb-4 max-w-[62ch] font-bold text-foreground/72 leading-relaxed">
							{t("prices.body1")}
						</p>
						<p className="mb-4 max-w-[62ch] font-bold text-foreground/72 leading-relaxed">
							{t("prices.body2")}
						</p>
						<p
							className={cn(
								DISPLAY,
								"gd-outline gd-shadow-5 mt-2 mb-7 inline-block rotate-2 rounded-[calc(var(--radius)*1.125)] bg-(--gd-sun) px-[1.2em] py-[0.7em] text-[1.05rem] leading-snug",
							)}
						>
							{t("prices.promise")}
						</p>
						<div>
							<a href="#book" className={BUTTON}>
								{t("prices.cta")}
							</a>
						</div>
					</div>
					<PriceMenuCard />
				</div>
			</section>
			<ScallopEdge fillClass="fill-(--gd-peach)" flip />
		</>
	);
}
