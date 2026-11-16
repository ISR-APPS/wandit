// The stationery fold: a photo on the start side, a vertical gold rule as the fold, and a price list on leader dots.
// LandingPage renders it after the packages. The monogram break closes the list: a gold hairline cut by the initials.
// The initials are the couple of the quote, Amel and Yanis.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BODY, H2, LABEL, SECTION, WRAP } from "../lib/type-styles";
import { PhotoFrame } from "./photo-frame";
import { ScriptWord } from "./script-word";

/** One line of the price list: the keys of the piece and of its price. */
type StationeryPrice = {
	nameKey: TranslationKey;
	priceKey: TranslationKey;
};

/** The pieces of a wedding suite, from the invitation to the seal. Prices per piece, in Algerian dinars. */
const STATIONERY_PRICES: readonly StationeryPrice[] = [
	{ nameKey: "stationery.invitation", priceKey: "stationery.invitationPrice" },
	{ nameKey: "stationery.replyCard", priceKey: "stationery.replyCardPrice" },
	{ nameKey: "stationery.menu", priceKey: "stationery.menuPrice" },
	{ nameKey: "stationery.tablePlan", priceKey: "stationery.tablePlanPrice" },
	{ nameKey: "stationery.waxSeal", priceKey: "stationery.waxSealPrice" },
];

/** The fold: 0.44fr of photo and 0.56fr of text. Below 900px the rule turns horizontal under the photo. */
export function StationerySection() {
	const { t } = useT();
	return (
		<section aria-labelledby="stationery-title" className={SECTION}>
			<div
				className={`${WRAP} grid items-center gap-8 min-[900px]:grid-cols-[minmax(0,0.44fr)_minmax(0,0.56fr)] min-[900px]:gap-0`}
			>
				<PhotoFrame
					src="/images/place-card.webp"
					alt={t("stationery.photoAlt")}
					width={672}
					height={840}
					caption={t("stationery.photoCaption")}
					isCool
					motion="photo"
					frameClassName="aspect-[4/3] min-[900px]:aspect-[4/5]"
					imageClassName="object-[50%_92%]"
				/>
				<div className="border-(--voeu-gold-soft) max-[899px]:border-t max-[899px]:pt-[30px] min-[900px]:ms-[clamp(26px,4.4vw,72px)] min-[900px]:border-s min-[900px]:ps-[clamp(26px,4.4vw,72px)]">
					<div data-reveal="lift">
						<p className={LABEL}>{t("stationery.label")}</p>
						<h2
							id="stationery-title"
							className={cn(
								H2,
								"mt-5 max-w-[16ch] text-[clamp(1.95rem,3.6vw,3rem)] leading-[1.08]",
							)}
						>
							{t("stationery.title")}
						</h2>
						<p className={`${BODY} mt-5 max-w-[48ch]`}>
							{t("stationery.body")}
						</p>
					</div>
					<ul
						data-reveal="lift"
						aria-label={t("stationery.priceListLabel")}
						className="mt-[30px] border-(--voeu-hair) border-t"
					>
						{STATIONERY_PRICES.map((line) => (
							<li
								key={line.nameKey}
								className="flex items-baseline gap-3 border-(--voeu-hair) border-b py-[13px] text-[0.95rem]"
							>
								<span className="min-w-0">{t(line.nameKey)}</span>
								<span aria-hidden="true" className="voeu-leader" />
								<span className="flex-none whitespace-nowrap font-display text-[1.02rem]">
									{t(line.priceKey)}
								</span>
							</li>
						))}
					</ul>
					<div
						aria-hidden="true"
						data-reveal="lift"
						className="voeu-monogram mt-[34px] flex items-center gap-5"
					>
						<ScriptWord
							word="monogram"
							className="flex-none text-[clamp(2rem,3.4vw,2.9rem)]"
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
