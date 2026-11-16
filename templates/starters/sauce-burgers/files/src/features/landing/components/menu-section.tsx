// The menu: a full-width photo of the combo, then the ruled burger list beside three combo plates.
// LandingPage renders it after the info band. It reads the burgers and the combos of lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BURGERS, COMBOS, type PlateTone } from "../lib/content";
import {
	DISPLAY_TEXT,
	LIST_HEAD,
	LIST_NOTE,
	TITLE_LEADING,
	WRAP,
} from "../lib/type-styles";
import { Price } from "./price";
import { SectionEyebrow } from "./section-eyebrow";

const PLATE_CLASS_OF: Record<PlateTone, string> = {
	ink: "bg-foreground text-background",
	hot: "bg-primary text-primary-foreground",
	mustard: "bg-(--sc-mustard) text-foreground",
};

/**
 * The photo band sits directly under the info band. The two lists use different looks: ruled rows, then flat plates.
 * Under 1024px a burger row has two lines: the name and the price, then the contents.
 */
export function MenuSection() {
	const { t } = useT();
	return (
		<section id="menu" className="scroll-mt-15 pb-(--sc-pad)">
			<figure data-flick="cut" className="mb-[clamp(34px,5.4vh,64px)]">
				<img
					src="/images/combo-spread.webp"
					alt={t("menu.photoAlt")}
					width={1600}
					height={900}
					loading="lazy"
					className="sc-photo h-[clamp(240px,52vh,480px)] w-full object-cover object-[50%_27%]"
				/>
			</figure>
			<div className={WRAP}>
				<div
					data-flick="l"
					className="mb-[clamp(24px,4vh,44px)] flex flex-wrap items-end justify-between gap-4"
				>
					<div>
						<SectionEyebrow label={t("menu.eyebrow")} ground="cream" />
						<h2
							className={cn(
								DISPLAY_TEXT,
								"text-[clamp(2.4rem,6vw,4.6rem)]",
								TITLE_LEADING,
							)}
						>
							{t("menu.titleLine1")}
							<br />
							{t("menu.titleLine2")}
						</h2>
					</div>
					<p className="max-w-[36ch] text-[1.02rem]">{t("menu.intro")}</p>
				</div>
				<div className="grid gap-[clamp(26px,4vw,64px)] md:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
					<div data-flick="l">
						<h3 className={LIST_HEAD}>{t("menu.burgersHead")}</h3>
						<ul>
							{BURGERS.map((burger) => (
								<li
									key={burger.id}
									className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3.5 gap-y-1 border-foreground/18 border-b py-[15px] lg:flex"
								>
									<span
										className={cn(
											DISPLAY_TEXT,
											"shrink-0 text-2xl leading-none",
										)}
									>
										{t(burger.nameKey)}
									</span>
									<span className="col-span-2 row-start-2 text-[0.9rem] text-foreground/72 leading-[1.4] lg:min-w-[130px] lg:flex-1">
										{t(burger.detailKey)}
									</span>
									<Price
										amountDa={burger.priceDa}
										unitTone="hot"
										className="col-start-2 row-start-1 lg:ms-auto"
									/>
								</li>
							))}
						</ul>
						<p className={cn(LIST_NOTE, "mt-4 border-t-0 pt-0")}>
							{t("menu.burgersNote")}
						</p>
					</div>
					<div data-flick="r">
						<h3 className={cn(LIST_HEAD, "mb-3.5")}>{t("menu.combosHead")}</h3>
						{COMBOS.map((combo) => (
							<div
								key={combo.id}
								className={cn(
									"mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 p-[clamp(16px,2vw,22px)]",
									PLATE_CLASS_OF[combo.plate],
								)}
							>
								<h4
									className={cn(
										DISPLAY_TEXT,
										"flex-[1_1_160px] text-[clamp(1.25rem,2vw,1.6rem)] leading-none",
									)}
								>
									{t(combo.nameKey)}
								</h4>
								<Price amountDa={combo.priceDa} unitTone="inherit" />
								<p className="basis-full text-[0.86rem] leading-[1.35] opacity-90">
									{t(combo.detailKey)}
								</p>
							</div>
						))}
						<p className={cn(LIST_NOTE, "mt-4")}>{t("menu.combosNote")}</p>
					</div>
				</div>
			</div>
		</section>
	);
}
