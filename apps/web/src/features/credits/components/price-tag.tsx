import { cn } from "@wandit/ui/lib/utils";

import { Spark } from "@/components/logo";
import { useTranslation } from "@/lib/i18n";
import { formatCreditAmount } from "../lib/format-credits";

type PriceTagProps = {
	cost: number;
	withIcon?: boolean;
	showUnit?: boolean;
	className?: string;
};

/** "10 credits" in the mono ledger voice. Muted by default; restyle via className. */
export function PriceTag({
	cost,
	withIcon = false,
	showUnit = true,
	className,
}: PriceTagProps) {
	const { locale, t } = useTranslation();
	// Charges render exact trimmed decimals (3, 0.1, 20) — never raw floats.
	const formattedCost = formatCreditAmount(cost, locale);
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 font-medium font-mono text-muted-foreground text-xs tabular-nums",
				className,
			)}
		>
			{withIcon ? <Spark className="size-3" /> : null}
			{showUnit
				? t("credits.creditUnit", { count: cost, countDisplay: formattedCost })
				: formattedCost}
		</span>
	);
}
