import { formatNumber } from "@wandit/internationalization";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import {
	type AffiliateProgramTermsParts,
	formatAffiliateMoney,
	formatAffiliateRate,
} from "../lib/affiliate-portal-format";

type PortalProgramTermsProps = {
	className?: string;
	parts: AffiliateProgramTermsParts;
};

export function PortalProgramTerms({
	className,
	parts,
}: PortalProgramTermsProps) {
	const { locale, t } = useTranslation();
	const terms = [
		parts.kind === "percentage_recurring"
			? t("affiliates.terms.percentageRecurring", {
					rate: formatAffiliateRate(parts.rateBps, locale),
				})
			: t("affiliates.terms.fixedOneTime", {
					amount: formatAffiliateMoney(
						parts.amountCents,
						parts.currency,
						locale,
					),
				}),
	];

	if (parts.kind === "percentage_recurring") {
		terms.push(
			parts.durationMonths === null
				? t("affiliates.terms.lifetime")
				: t("affiliates.terms.forMonths", {
						count: parts.durationMonths,
						countDisplay: formatNumber(parts.durationMonths, locale),
					}),
		);
	}

	if (parts.holdDays !== undefined) {
		terms.push(
			t("affiliates.terms.holdDays", {
				count: parts.holdDays,
				countDisplay: formatNumber(parts.holdDays, locale),
			}),
		);
	}

	return (
		<span className={cn("text-muted-foreground text-xs", className)}>
			{terms.join(" · ")}
		</span>
	);
}
