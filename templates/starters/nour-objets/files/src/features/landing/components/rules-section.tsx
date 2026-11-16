// Section 05, the rules of the window: four shop rules in one ruled band, each under a mono numeral.
// LandingPage renders it. It reads the "rules" group of messages.ts.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BAND, KICKER, MONO, WRAP } from "../lib/type-styles";

/** The four rules, in the order of the counter sign. */
const RULES: readonly { titleKey: TranslationKey; bodyKey: TranslationKey }[] =
	[
		{ titleKey: "rules.deliveryTitle", bodyKey: "rules.deliveryBody" },
		{ titleKey: "rules.pickupTitle", bodyKey: "rules.pickupBody" },
		{ titleKey: "rules.returnsTitle", bodyKey: "rules.returnsBody" },
		{ titleKey: "rules.packingTitle", bodyKey: "rules.packingBody" },
	];

/** Four columns from 901px, two from 481px, one below. Hairlines stand between the cells only. */
export function RulesSection() {
	const { t } = useT();
	return (
		<section id="rules" className={BAND}>
			<div className={WRAP}>
				<div data-reveal="">
					<div className="nour-fade flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
						<h2 className={KICKER}>{t("rules.kicker")}</h2>
						<p className={MONO}>{t("rules.aside")}</p>
					</div>
				</div>
				<ol
					data-reveal=""
					className="mt-[clamp(26px,3vw,38px)] grid border-foreground border-t min-[481px]:grid-cols-2 min-[901px]:grid-cols-4"
				>
					{RULES.map((rule, index) => (
						<li
							key={rule.titleKey}
							className={cn(
								"nour-fade border-foreground/9 py-[18px]",
								// One column: the numeral takes its own narrow track, so the text gets the full width beside it.
								"max-[480px]:grid max-[480px]:grid-cols-[44px_minmax(0,1fr)] max-[480px]:items-baseline",
								// One column: a line under each rule but the last. Two columns: under the first row only.
								index < 2 && "border-b min-[901px]:border-b-0",
								index === 2 && "border-b min-[481px]:border-b-0",
								index % 2 === 0
									? "min-[481px]:border-e min-[481px]:pe-[clamp(14px,1.6vw,26px)]"
									: "min-[481px]:ps-[clamp(14px,1.6vw,26px)]",
								index > 0 && "min-[901px]:ps-[clamp(14px,1.6vw,26px)]",
								index < RULES.length - 1 &&
									"min-[901px]:border-e min-[901px]:pe-[clamp(14px,1.6vw,26px)]",
							)}
						>
							<span className="nour-mono block text-[clamp(1.1rem,1.7vw,1.45rem)] leading-none tracking-[-0.01em]">
								{String(index + 1).padStart(2, "0")}
							</span>
							<h3 className="mt-3.5 font-display font-medium text-[16px] tracking-[-0.012em] max-[480px]:mt-0">
								{t(rule.titleKey)}
							</h3>
							<p className="col-start-2 mt-2 max-w-[38ch] text-[13.5px] text-muted-foreground leading-[1.5] tracking-normal">
								{t(rule.bodyKey)}
							</p>
						</li>
					))}
				</ol>
				<p className={`${MONO} border-foreground/9 border-t pt-3`}>
					{t("rules.foot")}
				</p>
			</div>
		</section>
	);
}
