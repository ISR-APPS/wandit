/**
 * One line with the commission terms of a program, for example
 * "20% recurring · for 12 months · 30-day hold". The links and referrals
 * tables render it. It formats with affiliate-portal-format.ts.
 */
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

/** The terms of one program as a muted inline span. A fixed one-time program has no duration part. */
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
		<span
			className={cn("text-night/60 text-xs dark:text-foreground/60", className)}
		>
			{terms.join(" · ")}
		</span>
	);
}
