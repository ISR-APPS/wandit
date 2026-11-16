// The estate sheet: a ledger of six facts beside the statement of the developer, then a rail of four distances.
// LandingPage renders it on the second ground. Its id "estate" is the target of the header link.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	BODY,
	KEY_LABEL,
	LABEL,
	RULE_LABEL,
	SECTION,
	WRAP,
} from "../lib/type-styles";
import { Ledger } from "./ledger";

/** A split of 5 to 7 from 1024px. The statement is the <h2> of the section. */
export function EstateSection() {
	const { t } = useT();
	const distances = [
		{ label: t("estate.railSeaLabel"), value: t("estate.railSeaValue") },
		{ label: t("estate.railMarinaLabel"), value: t("estate.railMarinaValue") },
		{ label: t("estate.railCityLabel"), value: t("estate.railCityValue") },
		{
			label: t("estate.railAirportLabel"),
			value: t("estate.railAirportValue"),
		},
	];
	return (
		<section
			id="estate"
			aria-labelledby="estate-title"
			className={cn(SECTION, "scroll-mt-16 bg-canvas")}
		>
			<div className={WRAP}>
				<div className="grid gap-[clamp(2.2rem,4vw,4.5rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
					<div data-reveal="lift">
						<p className={RULE_LABEL}>{t("estate.label")}</p>
						<Ledger
							layout="split"
							className="mt-[clamp(1.6rem,2.6vw,2.4rem)]"
							rows={[
								{
									label: t("estate.locationLabel"),
									value: t("estate.locationValue"),
								},
								{ label: t("estate.parkLabel"), value: t("estate.parkValue") },
								{
									label: t("estate.villasLabel"),
									value: t("estate.villasValue"),
								},
								{
									label: t("estate.surfacesLabel"),
									value: t("estate.surfacesValue"),
								},
								{
									label: t("estate.deliveryLabel"),
									value: t("estate.deliveryValue"),
								},
								{
									label: t("estate.architectLabel"),
									value: t("estate.architectValue"),
								},
							]}
						/>
					</div>
					<div>
						<h2
							id="estate-title"
							data-reveal="lift"
							className="max-w-[20ch] font-display font-normal text-[clamp(1.45rem,2.9vw,2.55rem)] leading-[1.2] tracking-[-0.006em]"
						>
							{t("estate.statementStart")}{" "}
							<span className="text-(--dlp-bronze-deep)">
								{t("estate.statementAccent")}
							</span>
						</h2>
						<div
							data-reveal="lift"
							className="mt-[clamp(1.6rem,2.6vw,2.2rem)] grid gap-[1.1rem]"
						>
							<p className={BODY}>{t("estate.body1")}</p>
							<p className={BODY}>{t("estate.body2")}</p>
						</div>
						<p
							data-reveal="lift"
							className={cn(
								LABEL,
								"mt-8 inline-block border-foreground/24 border-t pt-[0.9rem]",
							)}
						>
							{t("estate.signature")}
						</p>
					</div>
				</div>
				<dl
					data-reveal="rail"
					className="mt-[clamp(2.6rem,4.5vw,4rem)] grid grid-cols-2 border-foreground/12 border-s border-t border-t-foreground/24 md:grid-cols-4"
				>
					{distances.map((distance) => (
						<div
							key={distance.label}
							className="min-w-0 border-foreground/12 border-e border-b px-[clamp(0.8rem,1.6vw,1.4rem)] pt-4 pb-[1.15rem]"
						>
							<dt className={KEY_LABEL}>{distance.label}</dt>
							<dd className="mt-[0.45rem] font-display text-[clamp(1.15rem,1.9vw,1.7rem)] leading-[1.1]">
								{distance.value}
							</dd>
						</div>
					))}
				</dl>
			</div>
		</section>
	);
}
