// Page 3 of the paper, "Small ads — the menu": the menu set as classified ads in three ruled columns on the deeper stock.
// LandingPage renders it after the stop-press band. MENU of lib/content.ts holds the categories and the prices.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { MENU } from "../lib/content";
import { Price } from "./price";
import { SectionHead } from "./section-head";
import { Slug } from "./slug";

/** Three slugged categories of four ads each. Each ad: caps lead-in, one sentence, bold price. */
export function MenuSection() {
	const { t } = useT();
	return (
		<section
			id="menu"
			aria-labelledby="menu-title"
			data-roll-group
			className="ks-section bg-canvas"
		>
			<div className="ks-wrap">
				<SectionHead
					titleId="menu-title"
					pageKey="menu.page"
					titleKey="menu.title"
					noteKey="menu.note"
				/>
				<p data-roll className="ks-roll mb-8 max-w-[56ch]">
					{t("menu.intro")}
				</p>
				<div data-roll className="ks-roll grid gap-y-8 min-[860px]:grid-cols-3">
					{MENU.map((category, index) => (
						<div
							key={category.titleKey}
							className={cn(
								"min-[860px]:px-[clamp(1.2rem,2.2vw,2.4rem)]",
								index === 0 && "min-[860px]:ps-0",
								index === MENU.length - 1 && "min-[860px]:pe-0",
								index > 0 &&
									"min-[860px]:border-(--ks-rule) min-[860px]:border-s",
							)}
						>
							<Slug as="h3" className="mb-1.5">
								{t(category.titleKey)}
							</Slug>
							<ul>
								{category.items.map((item) => (
									<li
										key={item.nameKey}
										className="border-(--ks-rule-faint) border-b py-2.5 text-[0.95rem] leading-normal"
									>
										<span className="font-bold font-sans text-[0.86em] uppercase tracking-[0.06em]">
											{t(item.nameKey)}
										</span>{" "}
										{t(item.noteKey)} <Price euros={item.price} />
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
