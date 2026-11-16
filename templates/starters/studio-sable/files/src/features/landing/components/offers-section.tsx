// Section 04, the offers: four columns with a starting price and a real lead time each.
// LandingPage renders it. The header link "services" jumps here. The texts are in the `offers` message group.
import { useT } from "~/shared/i18n";
import { BAND, SECTION_TITLE, WRAP } from "../lib/type-styles";
import { AccentDot } from "./accent-dot";
import { type Offer, OfferColumn } from "./offer-column";
import { SectionHead } from "./section-head";

// The four offers in page order. Each id is the key prefix of its texts in the `offers` message group.
const OFFER_IDS = ["identity", "edition", "interface", "wayfinding"] as const;

/** The services ledger. The prices are stated plainly: a studio that hides them looks unsure. */
export function OffersSection() {
	const { t } = useT();
	const offers: Offer[] = OFFER_IDS.map((id, index) => ({
		number: `0${index + 1}`,
		title: t(`offers.${id}Title`),
		items: [
			t(`offers.${id}Item1`),
			t(`offers.${id}Item2`),
			t(`offers.${id}Item3`),
		],
		price: t(`offers.${id}Price`),
		duration: t(`offers.${id}Duration`),
	}));
	return (
		<section
			id="services"
			aria-labelledby="services-title"
			data-cascade=""
			className={BAND}
		>
			<div className={WRAP}>
				<SectionHead label={t("offers.label")}>
					<h2 id="services-title" className={`${SECTION_TITLE} sable-fade`}>
						{t("offers.title")}
						<AccentDot />
					</h2>
				</SectionHead>
				<div className="sable-offers">
					{offers.map((offer) => (
						<OfferColumn key={offer.number} offer={offer} />
					))}
				</div>
			</div>
		</section>
	);
}
