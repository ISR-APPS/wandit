// Shakes and sides: two price boards, the shake portrait, and the fries photo.
// LandingPage renders it after the drive. It gives the shakes and the sides of lib/content.ts to PriceBoard.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { SHAKES, SIDES } from "../lib/content";
import {
	DISPLAY_TEXT,
	LABEL_TEXT,
	LIST_HEAD,
	LIST_NOTE,
	TITLE_LEADING,
	WRAP,
} from "../lib/type-styles";
import { DripEdge } from "./drip-edge";
import { PriceBoard } from "./price-board";
import { SectionEyebrow } from "./section-eyebrow";

const CAPTION_CLASS = cn(LABEL_TEXT, "pt-2.5 tracking-[0.11em]");

/** Three columns from 1024px. From 640px the shake portrait keeps one column, beside the two lists. */
export function SidesSection() {
	const { t } = useT();
	return (
		<section id="shakes" className="relative scroll-mt-15 py-(--sc-pad)">
			<DripEdge variant="b" tone="hot" />
			<div className={WRAP}>
				<div
					data-flick="r"
					className="mb-[clamp(22px,3.4vh,40px)] flex flex-wrap items-end justify-between gap-3.5"
				>
					<div>
						<SectionEyebrow label={t("sides.eyebrow")} ground="cream" />
						<h2
							className={cn(
								DISPLAY_TEXT,
								"text-[clamp(2.1rem,5vw,3.6rem)]",
								TITLE_LEADING,
							)}
						>
							{t("sides.titleLine1")}
							<br />
							{t("sides.titleLine2")}
						</h2>
					</div>
					<p className="max-w-[32ch]">{t("sides.intro")}</p>
				</div>
				<div className="grid items-start gap-[clamp(20px,3vw,48px)] sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
					<figure data-flick="cut" className="sm:row-span-2 lg:row-span-1">
						{/* The studio red of this photo is deeper than the page accent. The zoom keeps the frame mostly glass. */}
						<span className="block overflow-hidden">
							<img
								src="/images/caramel-shake.webp"
								alt={t("sides.shakeAlt")}
								width={1000}
								height={1334}
								loading="lazy"
								className="sc-photo h-[clamp(300px,60vh,570px)] w-full scale-[1.26] object-cover object-[50%_44%]"
							/>
						</span>
						<figcaption className={CAPTION_CLASS}>
							{t("sides.shakeCaption")}
						</figcaption>
					</figure>
					<div data-flick="r">
						<h3 className={LIST_HEAD}>{t("sides.shakesHead")}</h3>
						<PriceBoard items={SHAKES} />
						<p className={cn(LIST_NOTE, "mt-4")}>{t("sides.shakesNote")}</p>
						<p className="mt-[clamp(14px,2.2vh,22px)] bg-(--sc-mustard) px-4 py-3.5 font-semibold text-[0.9rem]">
							{t("sides.extras")}
						</p>
					</div>
					<div data-flick="r">
						<figure className="mb-[clamp(18px,2.6vh,26px)]">
							<img
								src="/images/house-fries.webp"
								alt={t("sides.friesAlt")}
								width={1000}
								height={1340}
								loading="lazy"
								className="sc-photo h-[clamp(170px,22vh,210px)] w-full object-cover object-[50%_38%]"
							/>
							<figcaption className={CAPTION_CLASS}>
								{t("sides.friesCaption")}
							</figcaption>
						</figure>
						<h3 className={LIST_HEAD}>{t("sides.sidesHead")}</h3>
						<PriceBoard items={SIDES} />
						<p className={cn(LIST_NOTE, "mt-4")}>{t("sides.sidesNote")}</p>
					</div>
				</div>
			</div>
		</section>
	);
}
