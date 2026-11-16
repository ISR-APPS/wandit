// The price pair: exactly two cards, then one honest footnote.
// LandingPage renders it on the cool ground. The recommended card sits 10px higher from 768px.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { SECTION_SPACE, TRUST_LINE, WRAP } from "../lib/class-names";
import { PriceCard } from "./price-card";
import { SectionHead } from "./section-head";

/** Both actions lead to the contact section: a starter has no payment and no sign-up flow for visitors. */
export function PricingSection() {
	const { t } = useT();
	return (
		<section
			id="pricing"
			aria-label={t("pricing.label")}
			className={cn("bg-background", SECTION_SPACE)}
		>
			<div className={WRAP}>
				<SectionHead
					label={t("pricing.label")}
					title={t("pricing.title")}
					align="center"
				/>
				<div className="mx-auto mt-12 grid max-w-[880px] gap-[clamp(1.5rem,3vw,2.2rem)] md:grid-cols-2">
					<div data-reveal>
						<PriceCard
							name={t("pricing.shopName")}
							audience={t("pricing.shopFor")}
							price={t("pricing.shopPrice")}
							points={[
								t("pricing.shopPoint1"),
								t("pricing.shopPoint2"),
								t("pricing.shopPoint3"),
							]}
							actionLabel={t("pricing.shopCta")}
						/>
					</div>
					<div data-reveal className="[--fw-delay:110ms] md:-translate-y-2.5">
						<PriceCard
							name={t("pricing.businessName")}
							audience={t("pricing.businessFor")}
							price={t("pricing.businessPrice")}
							points={[
								t("pricing.businessPoint1"),
								t("pricing.businessPoint2"),
								t("pricing.businessPoint3"),
								t("pricing.businessPoint4"),
							]}
							actionLabel={t("pricing.businessCta")}
							flag={t("pricing.businessFlag")}
						/>
					</div>
				</div>
				<p
					data-reveal
					className={cn(TRUST_LINE, "mx-auto mt-9 max-w-[640px] text-center")}
				>
					{t("pricing.note")}
				</p>
			</div>
		</section>
	);
}
