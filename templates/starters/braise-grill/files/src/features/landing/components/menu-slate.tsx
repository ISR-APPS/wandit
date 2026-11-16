// One charcoal slate of the menu: the dish family, a meta label, the ember rule, and four dishes with prices.
// MenuSection renders one per entry of MENU_SLATES. use-smoke-scrub.ts lights it through --br-lit.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { MenuSlateEntry } from "../lib/content";
import { MICRO_LABEL } from "../lib/type-styles";
import { Price } from "./price";

/** A slate. `data-slate` marks it for the smoke scrub, which lights the slates in DOM order. */
export function MenuSlate({ slate }: { slate: MenuSlateEntry }) {
	const { t } = useT();
	return (
		<article className="br-slate" data-slate>
			<div aria-hidden="true" className="br-slate__heat" />
			<header className="relative z-[2] flex flex-wrap items-baseline justify-between gap-x-3.5 gap-y-1">
				<h3 className="font-display font-semibold text-[clamp(1.15rem,1.6vw,1.5rem)] leading-tight tracking-[-0.02em]">
					{t(slate.titleKey)}
				</h3>
				<p className={cn(MICRO_LABEL, "tracking-[0.14em]")}>
					{t(slate.metaKey)}
				</p>
			</header>
			<span aria-hidden="true" className="br-slate__rule" />
			<ul className="relative z-[2]">
				{slate.dishes.map((dish) => (
					<li key={dish.nameKey} className="br-dish">
						<span className="text-[clamp(13.5px,0.98vw,15.5px)] text-foreground/75 leading-[1.35]">
							{t(dish.nameKey)}
						</span>
						<span aria-hidden="true" className="br-leader" />
						<Price
							amountDa={dish.priceDa}
							className="text-[clamp(13.5px,1vw,15.5px)]"
						/>
					</li>
				))}
			</ul>
		</article>
	);
}
