import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";
import { useCreditBalance } from "@/features/credits/api/credits.queries";
import { formatCreditBalance } from "@/features/credits/lib/format-credits";

/** App-bar credits pill: ✦ + balance in mono (light prototype §2.2). */
export function CreditsChip() {
	const accent = useThemeColor("accent");
	const { locale } = useTranslation();
	const { data } = useCreditBalance();

	return (
		<View className="h-9 flex-row items-center gap-1.5 rounded-full border border-border bg-surface px-3 dark:bg-surface-tertiary/65">
			<WanditIcon name="spark" size={12} color={accent} />
			<Text className="font-mono-semibold text-[12px] text-foreground">
				{data ? formatCreditBalance(data.balance, locale) : "—"}
			</Text>
		</View>
	);
}
