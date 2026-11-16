// The sauces on the mustard ground: a macro photo of a sauce run beside the numbered list of the four free sauces.
// LandingPage renders it after the exploded burger. It reads the sauces of lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CHEDDAR_POT_PRICE_DA, SAUCES } from "../lib/content";
import {
	DISPLAY_TEXT,
	LABEL_TEXT,
	TITLE_LEADING,
	WRAP,
} from "../lib/type-styles";
import { DripEdge } from "./drip-edge";
import { Price } from "./price";
import { SectionEyebrow } from "./section-eyebrow";

const ROW_CLASS =
	"grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3.5 gap-y-1.5 border-foreground/30 border-b py-4 sm:flex sm:flex-wrap";
const NUMERAL_CLASS =
	"w-[1.5em] shrink-0 font-display text-[1.7rem] text-primary leading-none";
const DETAIL_CLASS =
	"col-span-2 col-start-2 row-start-2 text-[0.9rem] text-foreground/80 sm:min-w-[150px] sm:flex-1";
// The tag and the price sit at the end of the first line of a row.
const ROW_END_CLASS = "col-start-3 row-start-1 justify-self-end sm:ms-auto";

/**
 * The only mustard field of the page. From 1024px the photo fills the start edge at full height.
 * On a phone the photo starts at the section top, under the drips. A sauce row has two lines there.
 */
export function SaucesSection() {
	const { t } = useT();
	return (
		<section
			id="sauces"
			className="relative scroll-mt-15 bg-(--sc-mustard) pb-(--sc-pad) lg:z-4 lg:pt-(--sc-pad)"
		>
			<DripEdge variant="c" tone="hot" />
			{/* From 1024px the photo covers the solid top band (16 of 66 units) of the next drip. So no mustard line shows under it.
			    z-4 on the section puts the photo over that drip (z-3), and the own drip of this section stays over the photo. */}
			<figure
				data-flick="cut"
				className="mb-[clamp(22px,3.4vh,34px)] lg:absolute lg:start-0 lg:top-0 lg:-bottom-[calc(var(--sc-drip)*0.25)] lg:mb-0 lg:w-[min(700px,calc(38%-22px+var(--sc-side)))]"
			>
				<img
					src="/images/sauce-pour.webp"
					alt={t("sauces.photoAlt")}
					width={1000}
					height={1334}
					loading="lazy"
					className="sc-photo h-[clamp(180px,26vh,260px)] w-full object-cover object-[50%_46%] lg:h-full lg:object-[56%_42%]"
				/>
			</figure>
			{/* The start padding keeps the text clear of the photo: 38% of the section. */}
			<div className={cn(WRAP, "lg:ps-[calc(var(--sc-gut)+38%)]")}>
				<div data-flick="r">
					<SectionEyebrow label={t("sauces.eyebrow")} ground="mustard" />
					<h2
						className={cn(
							DISPLAY_TEXT,
							"text-[clamp(2.2rem,5.2vw,3.8rem)]",
							TITLE_LEADING,
						)}
					>
						{t("sauces.titleLine1")}
						<br />
						{t("sauces.titleLine2")}
					</h2>
					<p className="mt-3.5 mb-[clamp(20px,3vh,32px)] max-w-[46ch] text-[clamp(1.02rem,1.35vw,1.28rem)]">
						{t("sauces.lede")}
					</p>
				</div>
				<ul data-flick="r" className="border-foreground border-t-[3px]">
					{SAUCES.map((sauce, index) => (
						<li key={sauce.id} className={ROW_CLASS}>
							<span className={NUMERAL_CLASS}>
								{String(index + 1).padStart(2, "0")}
							</span>
							<h3
								className={cn(
									DISPLAY_TEXT,
									"shrink-0 text-[1.25rem] leading-none",
								)}
							>
								{t(sauce.nameKey)}
							</h3>
							<p className={DETAIL_CLASS}>{t(sauce.detailKey)}</p>
							{sauce.tagKey === undefined ? null : (
								<span
									className={cn(
										LABEL_TEXT,
										ROW_END_CLASS,
										"bg-foreground px-2.25 py-1.25 text-background tracking-[0.1em]",
									)}
								>
									{t(sauce.tagKey)}
								</span>
							)}
						</li>
					))}
					{/* The paid pot is not one of the four. A plus sign takes the place of its number. */}
					<li className={ROW_CLASS}>
						<span aria-hidden="true" className={NUMERAL_CLASS}>
							+
						</span>
						<h3
							className={cn(
								DISPLAY_TEXT,
								"shrink-0 text-[1.25rem] leading-none",
							)}
						>
							{t("sauces.cheddarName")}
						</h3>
						<p className={DETAIL_CLASS}>{t("sauces.cheddarDetail")}</p>
						<Price
							amountDa={CHEDDAR_POT_PRICE_DA}
							unitTone="hot"
							isExtra
							className={cn(
								ROW_END_CLASS,
								"text-[clamp(1.35rem,2.2vw,1.7rem)] leading-none",
							)}
						/>
					</li>
				</ul>
			</div>
		</section>
	);
}
