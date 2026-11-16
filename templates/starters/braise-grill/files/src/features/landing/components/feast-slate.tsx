// The wide slate at the end of the menu: the five-course fire menu, a dessert photo, and the price per person.
// MenuSection renders it after the four slates. use-smoke-scrub.ts lights it last.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { FEAST_PRICE_DA } from "../lib/content";
import { BODY_TEXT, MICRO_LABEL } from "../lib/type-styles";
import { PhotoCaption } from "./photo-caption";
import { Price } from "./price";

/** The wide slate. Prose and price share one row, so the big figure lands on the inner end edge. */
export function FeastSlate() {
	const { t } = useT();
	return (
		<article className="br-slate br-slate--wide" data-slate>
			<div aria-hidden="true" className="br-slate__heat" />
			<div className="br-feast">
				<div>
					<div className="br-frame br-scrim br-feast__photo">
						<img
							src="/images/honey-toast.webp"
							width={1000}
							height={1334}
							alt={t("menu.feastPhotoAlt")}
							loading="lazy"
							className="br-photo"
						/>
					</div>
					<PhotoCaption>{t("menu.feastCaption")}</PhotoCaption>
				</div>
				<div>
					<header className="flex flex-wrap items-baseline justify-between gap-x-3.5 gap-y-1">
						<h3 className="font-display font-semibold text-[clamp(1.15rem,1.6vw,1.5rem)] leading-tight tracking-[-0.02em]">
							{t("menu.feastTitle")}
						</h3>
						<p className={cn(MICRO_LABEL, "tracking-[0.14em]")}>
							{t("menu.feastMeta")}
						</p>
					</header>
					<span aria-hidden="true" className="br-slate__rule" />
					<div className="mt-[clamp(14px,1.8vw,22px)] flex flex-col items-start gap-[clamp(14px,2.4vh,20px)] min-[860px]:flex-row min-[860px]:flex-wrap min-[860px]:items-end min-[860px]:justify-between min-[860px]:gap-[clamp(18px,3vw,44px)]">
						<p
							className={cn(
								BODY_TEXT,
								"max-w-[34ch] min-[860px]:flex-[1_1_24ch]",
							)}
						>
							{t("menu.feastBody")}
						</p>
						<p className="shrink-0 text-start min-[860px]:text-end">
							<Price
								amountDa={FEAST_PRICE_DA}
								className="block font-bold text-[clamp(1.6rem,3vw,2.5rem)] leading-none tracking-[-0.035em]"
							/>
							<span
								className={cn(MICRO_LABEL, "mt-2.5 block tracking-[0.14em]")}
							>
								{t("menu.feastPriceNote")}
							</span>
						</p>
					</div>
				</div>
			</div>
		</article>
	);
}
