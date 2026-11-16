// The first screen of the home page. It shows the claim, two actions, and three plinths of the week.
// It also shows four shop facts and the strip of references.
// LandingPage renders it. It reads the pieces of lib/pieces.ts and the "hero" group of messages.ts.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { HERO_PIECES, SHELF_PIECES, STOCKROOM_COUNT } from "../lib/pieces";
import {
	BUTTON_FILL,
	BUTTON_GHOST,
	KICKER,
	LEDGER_LABEL,
	MONO,
	WRAP,
} from "../lib/type-styles";
import { PieceCaption } from "./piece-caption";
import { Plinth } from "./plinth";

/** The four cells of the ledger: stock, delivery, pick-up, payment. */
const FACTS: readonly { labelKey: TranslationKey; valueKey: TranslationKey }[] =
	[
		{ labelKey: "hero.stockLabel", valueKey: "hero.stockValue" },
		{ labelKey: "hero.deliveryLabel", valueKey: "hero.deliveryValue" },
		{ labelKey: "hero.pickupLabel", valueKey: "hero.pickupValue" },
		{ labelKey: "hero.paymentLabel", valueKey: "hero.paymentValue" },
	];

/** The references of the strip: the three plinths of the hero first, then the other lines of the shelf. */
const STRIP_REFS = [
	...HERO_PIECES,
	...SHELF_PIECES.filter(
		(piece) => !HERO_PIECES.some((shown) => shown.ref === piece.ref),
	),
].map((piece) => piece.ref);

/** The storefront. The text column takes 41% from 900px, and the plinths take the rest. */
export function HeroSection() {
	const { t } = useT();
	return (
		<section className="pt-[clamp(2rem,5vh,3.6rem)] pb-[clamp(2.6rem,5vh,4rem)]">
			<div className={WRAP}>
				<div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-foreground/16 border-b pb-3.5">
					<span className={KICKER}>{t("hero.kicker")}</span>
					<span className={KICKER}>{t("site.addressShort")}</span>
				</div>

				<div className="grid gap-[clamp(30px,4vw,54px)] pt-[clamp(24px,3.4vw,40px)] min-[900px]:grid-cols-[minmax(0,41fr)_minmax(0,59fr)] min-[900px]:items-start">
					<div>
						<h1 className="max-w-[13ch] font-display font-medium text-[clamp(2.4rem,5.4vw,4.75rem)] leading-[0.95] tracking-[-0.042em]">
							{t("hero.title")}
						</h1>
						<p className="mt-[22px] max-w-[40ch] text-[clamp(1rem,1.2vw,1.1rem)] leading-[1.55]">
							{t("hero.lede")}
						</p>
						<div className="mt-[26px] flex flex-wrap gap-2.5">
							<a href="#shelf" className={BUTTON_FILL}>
								{t("hero.ctaShelf")}
							</a>
							<a href="#visit" className={BUTTON_GHOST}>
								{t("hero.ctaReserve")}
							</a>
						</div>
					</div>

					<div>
						<div className="mb-[clamp(12px,1.4vw,18px)] flex justify-between gap-3.5 border-foreground border-b pb-[9px]">
							<span className={cn(MONO, "text-foreground")}>
								{t("hero.windowHead")}
							</span>
							<span className={MONO}>
								{HERO_PIECES.length} / {STOCKROOM_COUNT}
							</span>
						</div>
						{/* Below 561px the first plinth takes the full width, and the two others share the next row. */}
						<div className="grid grid-cols-2 gap-x-[clamp(10px,1.4vw,18px)] gap-y-6 min-[561px]:grid-cols-3">
							{HERO_PIECES.map((piece, index) => (
								<article
									key={piece.ref}
									className={cn(
										"flex flex-col gap-[11px]",
										index === 0 && "col-span-2 min-[561px]:col-span-1",
									)}
								>
									<Plinth piece={piece} isEager />
									<PieceCaption piece={piece} detail="full" />
								</article>
							))}
						</div>
					</div>
				</div>

				<dl className="mt-[clamp(30px,4vw,48px)] grid grid-cols-2 border-foreground border-t min-[641px]:grid-cols-4">
					{FACTS.map((fact, index) => (
						<div
							key={fact.labelKey}
							// Vertical hairlines stand between the cells only: two columns on a phone, four from 641px.
							className={cn(
								"border-foreground/9 pt-3.5 pb-4",
								index < 2 && "border-b min-[641px]:border-b-0",
								index % 2 === 0
									? "border-e pe-[clamp(12px,1.5vw,24px)]"
									: "ps-[clamp(12px,1.5vw,24px)]",
								index > 0 && "min-[641px]:ps-[clamp(12px,1.5vw,24px)]",
								index < FACTS.length - 1 &&
									"min-[641px]:border-e min-[641px]:pe-[clamp(12px,1.5vw,24px)]",
							)}
						>
							<dt className={LEDGER_LABEL}>{t(fact.labelKey)}</dt>
							<dd className="mt-[5px] text-[clamp(13.5px,1.05vw,15.5px)] leading-[1.32]">
								{t(fact.valueKey)}
							</dd>
						</div>
					))}
				</dl>
				<ul
					aria-label={t("hero.refsLabel")}
					className="flex flex-wrap gap-x-[clamp(14px,2vw,30px)] gap-y-[5px] border-foreground/9 border-t pt-[11px]"
				>
					{STRIP_REFS.map((ref) => (
						<li
							key={ref}
							className="nour-mono text-[10.5px] text-muted-foreground tracking-[0.09em]"
						>
							{ref}
						</li>
					))}
					<li className="nour-mono ms-auto text-[10.5px] uppercase tracking-[0.09em]">
						+ {STOCKROOM_COUNT - SHELF_PIECES.length} {t("hero.refsMore")}
					</li>
				</ul>
			</div>
		</section>
	);
}
