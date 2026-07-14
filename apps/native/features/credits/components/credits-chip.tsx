import { useThemeColor } from "heroui-native";
import { Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";

type CreditsChipProps = {
	balance: number;
};

/** App-bar credits pill: ✦ + balance in mono (light prototype §2.2). */
export function CreditsChip({ balance }: CreditsChipProps) {
	const accent = useThemeColor("accent");

	return (
		<View className="h-9 flex-row items-center gap-1.5 rounded-full border border-border bg-surface px-3 dark:bg-surface-tertiary/65">
			<WanditIcon name="spark" size={12} color={accent} />
			<Text className="font-mono-semibold text-[12px] text-foreground">
				{balance}
			</Text>
		</View>
	);
}
