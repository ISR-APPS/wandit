// The proof row, "the square": one quote in the display serif, a sun rule, three hairline numbers, and a square photo.
// LandingPage renders it on the sable ground between the deep band and the quote. It is the only social proof of the page.
import { type TranslationKey, useT } from "~/shared/i18n";
import { PHOTOS } from "../lib/photos";
import {
	CAPTION,
	FIGURE,
	META,
	META_SMALL,
	SECTION,
	WRAP,
} from "../lib/type-styles";
import { LockedPhoto } from "./locked-photo";

/** One number of the agency, with its label. */
type AgencyNumber = {
	valueKey: TranslationKey;
	labelKey: TranslationKey;
};

/** Years since 2011, travellers carried, and the group limit. */
const AGENCY_NUMBERS: readonly AgencyNumber[] = [
	{ valueKey: "proof.yearsValue", labelKey: "proof.yearsLabel" },
	{ valueKey: "proof.travellersValue", labelKey: "proof.travellersLabel" },
	{ valueKey: "proof.groupValue", labelKey: "proof.groupLabel" },
];

/** The quote and the square. Two columns from 900px; the square comes after the numbers on a phone. */
export function ProofSection() {
	const { t } = useT();
	return (
		<section aria-labelledby="proof-title" className={`${SECTION} hz-sable`}>
			<div
				className={`${WRAP} grid items-center gap-x-[clamp(28px,5vw,72px)] gap-y-10 min-[900px]:grid-cols-[minmax(0,1fr)_auto]`}
			>
				<div data-reveal className="hz-rise">
					{/* A real heading for the outline. font-sans overrides the display face that the base gives every h2. */}
					<h2 id="proof-title" className={`${META} font-sans`}>
						{t("proof.label")}
					</h2>
					<blockquote className="mt-5 max-w-[24ch] text-pretty font-display font-normal text-[clamp(1.5rem,2.9vw,2.5rem)] leading-[1.24]">
						{t("proof.quote")}
					</blockquote>
					<span
						aria-hidden="true"
						className="hz-draw mt-7 mb-3.5 block h-px w-full max-w-[420px] bg-(--hz-sun-deep)"
					/>
					<p className={META_SMALL}>{t("proof.author")}</p>
					<ul className="mt-[34px] grid max-w-[560px] grid-cols-3 gap-[clamp(16px,3vw,44px)]">
						{AGENCY_NUMBERS.map((item) => (
							<li
								key={item.valueKey}
								className="border-(--hz-hair) border-t pt-3"
							>
								<span
									className={`${FIGURE} mb-1 block text-[clamp(1.5rem,2.4vw,2.1rem)] tabular-nums`}
								>
									{t(item.valueKey)}
								</span>
								<span className={`${META_SMALL} block`}>
									{t(item.labelKey)}
								</span>
							</li>
						))}
					</ul>
				</div>
				<figure data-reveal className="hz-rise">
					<LockedPhoto
						photo={PHOTOS.palms}
						lock={{ k: 1.4, ty: -5.7 }}
						alt={t("proof.photoAlt")}
						className="hz-wipe aspect-square w-full min-[900px]:size-[clamp(240px,24vw,320px)]"
					/>
					<figcaption className={CAPTION}>{t("proof.photoCaption")}</figcaption>
				</figure>
			</div>
		</section>
	);
}
