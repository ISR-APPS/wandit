// The services: three crafts in unequal columns on full-height gold rules.
// LandingPage renders it after the hero. The first column leads one type size up.
// Each column closes on a rose fact. A subgrid puts the three facts on one row, so their hairlines read as one broken rule.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { revealDelay } from "../lib/reveal-delay";
import {
	BODY,
	H2,
	H3,
	LABEL,
	LEDE,
	ROSE_FACT,
	SECTION,
	WRAP,
} from "../lib/type-styles";

/** One service column: the keys of its title, its text, and its fact. */
type ServiceColumn = {
	titleKey: TranslationKey;
	bodyKey: TranslationKey;
	factKey: TranslationKey;
};

/** The three crafts, in reading order. The first one is the lead column. */
const SERVICE_COLUMNS: readonly ServiceColumn[] = [
	{
		titleKey: "services.designTitle",
		bodyKey: "services.designBody",
		factKey: "services.designFact",
	},
	{
		titleKey: "services.stationeryTitle",
		bodyKey: "services.stationeryBody",
		factKey: "services.stationeryFact",
	},
	{
		titleKey: "services.coordinationTitle",
		bodyKey: "services.coordinationBody",
		factKey: "services.coordinationFact",
	},
];

/** The head (label, title, lede) above three columns of 1.22, 0.92, and 0.86fr. Below 900px the columns stack. */
export function ServicesSection() {
	const { t } = useT();
	return (
		<section id="services" aria-labelledby="services-title" className={SECTION}>
			<div className={WRAP}>
				<div className="grid items-end gap-5 min-[900px]:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] min-[900px]:gap-[clamp(24px,4vw,64px)]">
					<div data-reveal="lift">
						<p className={LABEL}>{t("services.label")}</p>
						<h2 id="services-title" className={`${H2} mt-[22px]`}>
							<span className="block">{t("services.titleLine1")}</span>
							<span className="block">{t("services.titleLine2")}</span>
						</h2>
					</div>
					<p data-reveal="lift" className={LEDE}>
						{t("services.lede")}
					</p>
				</div>
				<div className="mt-[clamp(44px,5vw,72px)] grid min-[900px]:grid-cols-[minmax(0,1.22fr)_minmax(0,0.92fr)_minmax(0,0.86fr)] min-[900px]:grid-rows-[auto_1fr_auto] min-[900px]:border-(--voeu-gold-soft) min-[900px]:border-t">
					{SERVICE_COLUMNS.map((column, index) => {
						const isLead = index === 0;
						return (
							<article
								key={column.titleKey}
								data-reveal="lift"
								style={revealDelay(index)}
								className={cn(
									"flex flex-col border-(--voeu-gold-soft) max-[899px]:mt-8 max-[899px]:border-t max-[899px]:pt-[26px] min-[900px]:row-span-3 min-[900px]:grid min-[900px]:grid-rows-subgrid min-[900px]:border-s min-[900px]:px-[clamp(20px,2.4vw,38px)] min-[900px]:pt-[34px] min-[900px]:last:pe-0 min-[900px]:first:border-s-0 min-[900px]:first:ps-0",
									isLead && "min-[900px]:pt-[clamp(26px,2.6vw,34px)]",
								)}
							>
								<h3
									className={cn(
										H3,
										isLead &&
											"min-[900px]:text-[clamp(1.7rem,2.7vw,2.5rem)] min-[900px]:leading-[1.08]",
									)}
								>
									{t(column.titleKey)}
								</h3>
								<p
									className={cn(
										BODY,
										"mt-[14px] mb-7",
										isLead &&
											"min-[900px]:mt-[18px] min-[900px]:text-[1.06rem]",
									)}
								>
									{t(column.bodyKey)}
								</p>
								<p
									className={`${ROSE_FACT} mt-auto border-(--voeu-hair) border-t pt-[14px] min-[900px]:mt-0`}
								>
									{t(column.factKey)}
								</p>
							</article>
						);
					})}
				</div>
			</div>
		</section>
	);
}
