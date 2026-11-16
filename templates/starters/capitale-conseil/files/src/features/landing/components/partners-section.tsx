// The governance ledger: the four partners of the firm. LandingPage renders it after the quote.
// Each partner has a square serif monogram, a role, a field, and a year. The page shows no portrait.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PARTNER_IDS } from "../lib/content";
import { LABEL, MOVEMENT, SECTION_TITLE, SOFT } from "../lib/type-styles";
import { SectionLabel } from "./section-label";

/** Two columns on a phone and four from 900px, with hairlines between the columns. */
export function PartnersSection() {
	const { t } = useT();
	return (
		<section className={MOVEMENT}>
			<div className="cap-wrap">
				<SectionLabel data-reveal className="mb-[1.4rem]">
					{t("partners.label")}
				</SectionLabel>
				<h2 data-reveal className={cn(SECTION_TITLE, "max-w-[24ch]")}>
					{t("partners.title")}
				</h2>
				<div
					data-reveal="rule"
					className="mt-[clamp(2rem,4vh,3rem)] h-px bg-foreground/18"
				/>
				<div
					data-reveal-group
					className="grid grid-cols-2 min-[56.25rem]:grid-cols-4"
				>
					{PARTNER_IDS.map((partner, index) => (
						<div
							key={partner}
							data-reveal
							className={cn(
								"border-foreground/12 border-b py-[1.6rem] pe-4 min-[56.25rem]:border-b-0 min-[56.25rem]:pe-5 min-[56.25rem]:pt-[1.8rem] min-[56.25rem]:pb-0",
								// On a phone the hairline stands between the two columns. From 900px it stands before each column but the first.
								index % 2 === 1 && "border-s ps-4",
								index > 0 &&
									"min-[56.25rem]:border-s min-[56.25rem]:ps-[clamp(1rem,1.8vw,1.6rem)]",
							)}
						>
							<div
								aria-hidden="true"
								className="mb-4 flex size-11 items-center justify-center border border-primary font-display text-base text-primary tracking-[0.02em]"
							>
								{t(`partners.${partner}.initials`)}
							</div>
							<h3 className="mb-1.5 font-display font-normal text-[1.2rem] leading-[1.16] tracking-[-0.015em]">
								{t(`partners.${partner}.name`)}
							</h3>
							<p className={cn(LABEL, "text-primary")}>
								{t(`partners.${partner}.role`)}
							</p>
							<p className={cn(SOFT, "mt-2 text-[0.90625rem]")}>
								{t(`partners.${partner}.field`)}
							</p>
							<p className="mt-3 text-[0.78125rem] text-foreground/60 tabular-nums">
								{t(`partners.${partner}.since`)}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
