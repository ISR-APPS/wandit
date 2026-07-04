import { cn } from "@wandit/ui/lib/utils";

import { Spark } from "@/components/logo";
import { useTranslation } from "@/lib/i18n";

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
	const { t } = useTranslation();
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 font-medium font-mono text-muted-foreground text-xs tabular-nums",
				className,
			)}
		>
			{withIcon ? <Spark className="size-3" /> : null}
			{showUnit ? t("credits.creditUnit", { count: cost }) : cost}
		</span>
	);
}
