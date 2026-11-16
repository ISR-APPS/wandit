// "Today's menu": the price list of the studio as a diner menu card with a striped awning and dotted leaders.
// PricesSection renders it. The rows come from MENU_ROWS in lib/content.ts; a peek tooth sits on its corner.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { MENU_ROWS } from "../lib/content";
import { DISPLAY } from "../lib/styles";
import { PeekTooth } from "./peek-tooth";

/**
 * A white card tilted 1.2 degrees left, with a mint footnote strip at its foot.
 * Under 640px a side margin keeps the tilted corners and the 9px shadow inside the 16px page gutter.
 */
export function PriceMenuCard() {
	const { t } = useT();
	return (
		<div data-pop="self" className="relative max-sm:mx-2">
			<div className="gd-outline gd-shadow-9 relative -rotate-[1.2deg] overflow-hidden rounded-[calc(var(--radius)*1.75)] bg-card pb-7.5">
				<div
					aria-hidden="true"
					className="gd-awning h-11 border-foreground border-b-[length:var(--gd-line)]"
				/>
				<div className="px-[clamp(1.25rem,3vw,2rem)] pt-6">
					<h3 className={cn(DISPLAY, "text-center text-[1.9rem] leading-none")}>
						{t("prices.menuTitle")}
					</h3>
					<p className="mt-2 mb-5 text-center font-extrabold text-[0.85rem] text-primary uppercase tracking-[0.14em]">
						{t("prices.menuSub")}
					</p>
					<ul>
						{MENU_ROWS.map((row) => (
							<li
								key={row.itemKey}
								className="flex items-baseline gap-3 py-2.5"
							>
								<span className="font-bold font-display text-[clamp(0.98rem,1.4vw,1.08rem)] max-sm:whitespace-normal sm:whitespace-nowrap">
									{t(row.itemKey)}
								</span>
								<span aria-hidden="true" className="gd-leader min-w-6 flex-1" />
								<span
									className={cn(
										DISPLAY,
										"whitespace-nowrap text-(--gd-teal) text-[clamp(0.98rem,1.4vw,1.08rem)] tabular-nums",
									)}
								>
									{t(row.priceKey)}
								</span>
							</li>
						))}
					</ul>
				</div>
				<p className="gd-outline-thin mx-[clamp(1.25rem,3vw,2rem)] mt-5 rounded-[calc(var(--radius)*1)] bg-(--gd-mint) px-4.5 py-3 font-bold text-[0.92rem] leading-snug">
					{t("prices.footBefore")}
					<strong className="font-extrabold">{t("prices.footFree")}</strong>
					{t("prices.footAfter")}
				</p>
			</div>
			<PeekTooth className="absolute -end-2 -bottom-4 w-[clamp(70px,7vw,88px)] -rotate-10" />
		</div>
	);
}
