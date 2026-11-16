// The packages: three price cartons on the liner ground, the second ground of the page and its last use.
// LandingPage renders it after the process. Package II is the chosen one.
// Below 900px the cartons stack in their printed order, I then II then III, and the lift collapses.
import { useT } from "~/shared/i18n";
import { revealDelay } from "../lib/reveal-delay";
import { H2, LABEL, NOTE, SECTION, WRAP } from "../lib/type-styles";
import { PackageCarton, type PackageOffer } from "./package-carton";

/** The three packages, in printed order. The prices are in Algerian dinars, before the venue and the caterer. */
const PACKAGE_OFFERS: readonly PackageOffer[] = [
	{
		numberKey: "packages.essentialNumber",
		nameKey: "packages.essentialName",
		priceKey: "packages.essentialPrice",
		itemKeys: [
			"packages.essentialItem1",
			"packages.essentialItem2",
			"packages.essentialItem3",
			"packages.essentialItem4",
		],
		isChosen: false,
	},
	{
		numberKey: "packages.completeNumber",
		nameKey: "packages.completeName",
		priceKey: "packages.completePrice",
		itemKeys: [
			"packages.completeItem1",
			"packages.completeItem2",
			"packages.completeItem3",
			"packages.completeItem4",
			"packages.completeItem5",
		],
		isChosen: true,
	},
	{
		numberKey: "packages.signatureNumber",
		nameKey: "packages.signatureName",
		priceKey: "packages.signaturePrice",
		itemKeys: [
			"packages.signatureItem1",
			"packages.signatureItem2",
			"packages.signatureItem3",
			"packages.signatureItem4",
			"packages.signatureItem5",
		],
		isChosen: false,
	},
];

/** The head, the three cartons, and the terms under them. */
export function PackagesSection() {
	const { t } = useT();
	return (
		<section
			id="packages"
			aria-labelledby="packages-title"
			className={`${SECTION} bg-(--voeu-liner)`}
		>
			<div className={WRAP}>
				<div className="grid items-end gap-5 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,0.78fr)] min-[900px]:gap-[clamp(24px,4vw,60px)]">
					<div data-reveal="lift">
						<p className={LABEL}>{t("packages.label")}</p>
						<h2 id="packages-title" className={`${H2} mt-5 max-w-[16ch]`}>
							{t("packages.title")}
						</h2>
					</div>
					<p data-reveal="lift" className={`${NOTE} max-w-[44ch]`}>
						{t("packages.note")}
					</p>
				</div>
				<div className="mt-[clamp(48px,5vw,72px)] grid gap-8 min-[900px]:grid-cols-3 min-[900px]:items-stretch min-[900px]:gap-[clamp(18px,2.2vw,30px)]">
					{PACKAGE_OFFERS.map((offer, index) => (
						<PackageCarton
							key={offer.nameKey}
							offer={offer}
							style={revealDelay(index)}
						/>
					))}
				</div>
				<p
					data-reveal="lift"
					className="mt-[clamp(26px,3vw,38px)] max-w-[70ch] text-pretty border-(--voeu-hair) border-t pt-4 text-[0.87rem] text-foreground/72 leading-[1.7]"
				>
					{t("packages.terms")}
				</p>
			</div>
		</section>
	);
}
