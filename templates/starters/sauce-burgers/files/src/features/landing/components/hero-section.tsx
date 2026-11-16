// The hero: the wordmark, the claim, two actions, and three lead prices beside the portrait of the Double.
// LandingPage renders it first. From 768px the photo fills the end edge of the section at full height.
// It reads the lead prices from lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BURGERS, LEAD_BURGER_IDS } from "../lib/content";
import {
	BUTTON,
	BUTTON_GHOST,
	BUTTON_HOT,
	DISPLAY_TEXT,
	LABEL_TEXT,
	PHONE_FULL_WIDTH,
	WRAP,
} from "../lib/type-styles";
import { Price } from "./price";

/** The first screen. Its height stops at 780px, so the drip of the info band is in view under it. */
export function HeroSection() {
	const { t } = useT();
	const leadBurgers = BURGERS.filter((burger) =>
		LEAD_BURGER_IDS.includes(burger.id),
	);
	return (
		<section
			id="top"
			className="relative overflow-hidden pt-[clamp(40px,7vh,86px)] md:z-4 md:flex md:min-h-[min(80vh,780px)] md:items-center md:overflow-visible md:pb-[clamp(56px,8vh,96px)]"
		>
			{/* The end padding is the photo width plus the gutter, so the type never runs under the photo.
			    Below 1280px the photo takes 50% of the section; from 1280px it takes about 40%. */}
			<div
				className={cn(
					WRAP,
					"md:pe-[calc(var(--sc-gut)+50%)] xl:pe-[calc(var(--sc-gut)+40%)]",
				)}
			>
				<div className="max-w-[720px]">
					<p
						className={cn(
							LABEL_TEXT,
							"mb-[clamp(16px,2.4vh,26px)] inline-block bg-(--sc-mustard) px-2.75 py-1.5",
						)}
					>
						{t("hero.chip")}
					</p>
					<h1
						className={cn(
							DISPLAY_TEXT,
							"text-[clamp(4.6rem,10vw,9rem)] leading-[0.82]",
						)}
					>
						{t("site.brand")}
						<span className="text-primary">!</span>
					</h1>
					<p className="mt-[0.9em] font-bold font-sans text-[clamp(0.86rem,1.6vw,1.15rem)] text-primary uppercase leading-none tracking-[0.3em]">
						{t("hero.tagline")}
					</p>
					<p className="mt-4 mb-[clamp(20px,3vh,32px)] max-w-[44ch] text-[clamp(1.02rem,1.35vw,1.28rem)]">
						{t("hero.lede")}
					</p>
					{/* On a phone both actions take the full width, so the two buttons line up. */}
					<div className="mb-[clamp(20px,3vh,30px)] flex flex-wrap gap-3">
						<a
							href={t("site.phoneHref")}
							className={cn(BUTTON, BUTTON_HOT, PHONE_FULL_WIDTH)}
						>
							{t("site.orderVerb")} · {t("site.phoneDisplay")}
						</a>
						<a
							href="#menu"
							className={cn(
								BUTTON,
								BUTTON_GHOST,
								PHONE_FULL_WIDTH,
								"border-primary",
							)}
						>
							{t("hero.seeMenu")}
						</a>
					</div>
					{/* The price rule runs the full width of the type column. It closes the gap to the photo. */}
					<ul className="flex flex-wrap items-baseline gap-x-[clamp(14px,1.8vw,26px)] gap-y-2 border-foreground border-t-2 pt-3.5">
						{leadBurgers.map((burger) => (
							<li
								key={burger.id}
								className="flex items-baseline gap-[clamp(8px,0.9vw,12px)]"
							>
								<span className="font-bold text-xs uppercase tracking-[0.09em]">
									{t(burger.nameKey)}
								</span>
								<Price amountDa={burger.priceDa} unitTone="hot" />
							</li>
						))}
					</ul>
				</div>
			</div>
			{/* From 768px the photo covers the solid top band (16 of 66 units) of the info band drip. So the drips hang from the photo.
			    md:z-4 puts the photo over that drip (z-3). md:overflow-visible lets the photo pass the section bottom. */}
			<figure className="mt-[clamp(26px,4vh,40px)] md:absolute md:end-0 md:top-0 md:-bottom-[calc(var(--sc-drip)*0.25)] md:mt-0 md:w-[min(50vw,600px)] xl:w-[min(42vw,max(600px,calc(50vw-200px)))]">
				<img
					src="/images/double-burger.webp"
					alt={t("hero.photoAlt")}
					width={1200}
					height={1600}
					className="sc-photo h-[clamp(300px,48vh,440px)] w-full object-cover object-[52%_40%] md:h-full md:object-[50%_46%] xl:object-[52%_46%]"
				/>
				<figcaption
					className={cn(
						LABEL_TEXT,
						"ps-(--sc-gut) pt-2.5 pb-1 tracking-[0.11em] md:absolute md:start-0 md:bottom-3.5 md:bg-foreground md:px-2.75 md:py-1.75 md:text-background",
					)}
				>
					{t("hero.photoCaption")}
				</figcaption>
			</figure>
		</section>
	);
}
