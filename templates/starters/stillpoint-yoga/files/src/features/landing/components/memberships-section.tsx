// The memberships: a centered head, three tier cards with the clay one in the middle, and the free first class note.
// LandingPage renders it. The prices are fictional sample content in dollars.
import { useT } from "~/shared/i18n";
import { LEDE, SECTION_TITLE, SECTION_Y, WRAP } from "../lib/styles";
import { Eyebrow } from "./eyebrow";
import { TierCard } from "./tier-card";

/** The memberships section, anchor #memberships. One column, 520px wide, below 900px. */
export function MembershipsSection() {
	const { t } = useT();
	return (
		<section
			id="memberships"
			aria-labelledby="memberships-title"
			className={SECTION_Y}
		>
			<div className={WRAP}>
				<div className="mb-[clamp(48px,7vw,84px)] text-center">
					<Eyebrow centered>{t("memberships.eyebrow")}</Eyebrow>
					<h2
						id="memberships-title"
						data-reveal
						className={`${SECTION_TITLE} mx-auto mt-[22px] max-w-[16ch]`}
					>
						{t("memberships.titleLead")}{" "}
						<em className="text-primary italic">{t("memberships.titleEm")}</em>
					</h2>
					<p data-reveal className={`${LEDE} mx-auto mt-5`}>
						{t("memberships.lede")}
					</p>
				</div>
				<div
					data-reveal-group
					className="mx-auto grid max-w-[520px] items-stretch gap-[clamp(16px,2.4vw,28px)] min-[900px]:max-w-none min-[900px]:grid-cols-3"
				>
					<TierCard
						intentKey="memberships.dropInIntent"
						nameKey="memberships.dropInName"
						priceKey="memberships.dropInPrice"
						perKey="memberships.dropInPer"
						pointKeys={[
							"memberships.dropInPoint1",
							"memberships.dropInPoint2",
							"memberships.dropInPoint3",
						]}
						ctaKey="memberships.dropInCta"
					/>
					<TierCard
						flagKey="memberships.eightFlag"
						intentKey="memberships.eightIntent"
						nameKey="memberships.eightName"
						priceKey="memberships.eightPrice"
						perKey="memberships.eightPer"
						pointKeys={[
							"memberships.eightPoint1",
							"memberships.eightPoint2",
							"memberships.eightPoint3",
							"memberships.eightPoint4",
						]}
						ctaKey="memberships.eightCta"
					/>
					<TierCard
						intentKey="memberships.unlimitedIntent"
						nameKey="memberships.unlimitedName"
						priceKey="memberships.unlimitedPrice"
						perKey="memberships.unlimitedPer"
						pointKeys={[
							"memberships.unlimitedPoint1",
							"memberships.unlimitedPoint2",
							"memberships.unlimitedPoint3",
						]}
						ctaKey="memberships.unlimitedCta"
					/>
				</div>
				<p
					data-reveal
					className="mx-auto mt-[34px] max-w-[56ch] text-center text-(--sp-ink-78) text-[0.9rem]"
				>
					{t("memberships.note")}
				</p>
			</div>
		</section>
	);
}
