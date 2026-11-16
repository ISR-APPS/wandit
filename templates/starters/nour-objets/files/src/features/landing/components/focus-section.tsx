// Section 04, the piece in focus: one chair on a plate to the screen edge, with its full label.
// LandingPage renders it. It reads FOCUS_PIECE of lib/pieces.ts and the "focus" group of messages.ts.
import { type TranslationKey, useT } from "~/shared/i18n";
import { FOCUS_PIECE } from "../lib/pieces";
import { DOT, KICKER, LEDGER_LABEL, MONO, TITLE } from "../lib/type-styles";
import { Price } from "./price";
import { ReserveButton } from "./reserve-button";

/** The five rows of the label: a term and its value. */
const SPECS: readonly { labelKey: TranslationKey; valueKey: TranslationKey }[] =
	[
		{ labelKey: "focus.materialLabel", valueKey: "focus.materialValue" },
		{ labelKey: "focus.workshopLabel", valueKey: "focus.workshopValue" },
		{ labelKey: "focus.weightLabel", valueKey: "focus.weightValue" },
		{ labelKey: "focus.seriesLabel", valueKey: "focus.seriesValue" },
		{ labelKey: "focus.leadTimeLabel", valueKey: "focus.leadTimeValue" },
	];

/** From 1000px the photo takes 44% as a square plate. Below, it is a 4:5 plate over the text. */
export function FocusSection() {
	const { t } = useT();
	const piece = FOCUS_PIECE;
	return (
		<section id="piece" className="scroll-mt-16 border-foreground/16 border-t">
			<div className="grid min-[1000px]:grid-cols-[minmax(0,44fr)_minmax(0,56fr)] min-[1000px]:items-center">
				<figure data-reveal="">
					<div className="nour-fade">
						<div className="nour-plinth aspect-4/5 max-h-[80vh] min-[1000px]:aspect-square min-[1000px]:max-h-none">
							<img
								src={piece.photo.src}
								alt={t(piece.photo.altKey)}
								width={1440}
								height={1920}
								loading="lazy"
								className="object-[50%_48%]"
							/>
						</div>
						{/* nour-focus-caption starts the text on the container edge of the other bands, not on the photo edge. */}
						{/* Each item ends with its dot, so a wrapped line never starts with one. */}
						<figcaption className="nour-mono nour-focus-caption py-3 text-[10.5px] text-muted-foreground uppercase leading-[1.5] tracking-[0.045em]">
							<span className="whitespace-nowrap">
								<span aria-hidden="true" className={`${DOT} bg-primary`} />
								{t("pieces.ref")} {piece.ref} ·
							</span>{" "}
							<span className="whitespace-nowrap">
								{t("focus.captionMaterial")} ·
							</span>{" "}
							<span className="whitespace-nowrap">
								{t(piece.dimensionsKey)} ·
							</span>{" "}
							<b className="font-medium text-foreground">
								<Price amount={piece.price} />
							</b>
						</figcaption>
					</div>
				</figure>

				<div data-reveal="" className="nour-focus-body">
					<div className="nour-fade">
						<p className={KICKER}>{t("focus.kicker")}</p>
						<h2 className={`${TITLE} mt-3.5`}>{t(piece.nameKey)}</h2>
						<p className="mt-[18px] max-w-[52ch] text-[14.5px] leading-[1.6]">
							{t("focus.body")}
						</p>
					</div>

					<dl className="mt-[22px] border-foreground/16 border-t">
						{SPECS.map((spec) => (
							<div
								key={spec.labelKey}
								className="nour-fade grid grid-cols-[minmax(0,11ch)_minmax(0,1fr)] items-baseline gap-3.5 border-foreground/9 border-b py-[9px]"
							>
								<dt className={LEDGER_LABEL}>{t(spec.labelKey)}</dt>
								<dd className="text-[14px] leading-[1.35]">
									{t(spec.valueKey)}
								</dd>
							</div>
						))}
					</dl>

					<div className="nour-fade">
						<div className="mt-[26px] flex flex-wrap items-baseline gap-x-3.5 gap-y-2">
							<span className="nour-mono font-medium text-[clamp(2rem,4.4vw,3.2rem)] leading-none tracking-[-0.03em]">
								<Price amount={piece.price} />
							</span>
							<span className={`${MONO} leading-none`}>
								<span aria-hidden="true" className={`${DOT} bg-primary`} />
								{t("focus.stock")}
							</span>
						</div>
						<div className="mt-[22px] flex flex-wrap items-center gap-3.5">
							<ReserveButton
								pieceRef={piece.ref}
								label={t("focus.reserve")}
								size="large"
							/>
							<span className={MONO}>{t("focus.noPayment")}</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
