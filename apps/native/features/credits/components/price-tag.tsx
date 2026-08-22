import { useTranslation } from "@wandit/internationalization/react";
import { cn, useThemeColor } from "heroui-native";
import { Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";
import { formatCreditAmount } from "../lib/format-credits";

type PriceTagProps = {
	cost: number;
	withIcon?: boolean;
	showUnit?: boolean;
	className?: string;
};

/** "10 credits" in the mono ledger voice — native twin of the web PriceTag.
    Muted by default; restyle via className. VoiceOver always gets the full
    unit string, even when the visual drops it (showUnit false). */
export function PriceTag({
	cost,
	withIcon = false,
	showUnit = true,
	className,
}: PriceTagProps) {
	const { locale, t } = useTranslation();
	const muted = useThemeColor("muted");
	// Charges render exact trimmed decimals (3, 0.1, 20) — never raw floats.
	const formattedCost = formatCreditAmount(cost, locale);
	const unitLabel = t("credits.creditUnit", {
		count: cost,
		countDisplay: formattedCost,
	});
	return (
		<View className={cn("flex-row items-center gap-1", className)}>
			{withIcon ? <WanditIcon name="spark" size={10} color={muted} /> : null}
			<Text
				accessibilityLabel={unitLabel}
				className="font-mono text-[11px] text-muted"
				// Bare number = numeric counter (ltr); the unit-carrying string is
				// real RTL text in AR and keeps the default direction.
				style={showUnit ? undefined : { writingDirection: "ltr" }}
			>
				{showUnit ? unitLabel : formattedCost}
			</Text>
		</View>
	);
}
