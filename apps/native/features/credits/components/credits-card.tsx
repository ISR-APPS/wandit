import { useTranslation } from "@wandit/internationalization/react";
import { Text, View } from "react-native";

import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

type CreditsCardProps = {
	balance: number;
	grant: number;
};

/** Credits summary card inside the project sheet (light prototype §4.1). */
export function CreditsCard({ balance, grant }: CreditsCardProps) {
	const { t } = useTranslation();
	const fillPercent = Math.max(4, Math.min(100, (balance / grant) * 100));

	return (
		<View className="rounded-[18px] border border-border bg-surface p-3.5">
			<View className="flex-row items-baseline justify-between">
				<Text className="font-sans-bold text-[14px] text-foreground">
					{t("native.credits.title")}
				</Text>
				<Text className="font-mono text-[13px] text-muted">
					{t("native.credits.left", { count: balance })}
				</Text>
			</View>
			<View className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-secondary dark:bg-surface-tertiary">
				<View
					className="relative h-full overflow-hidden rounded-full"
					style={{ width: `${fillPercent}%` }}
				>
					<BrandGradientFill radius={4} />
				</View>
			</View>
			<View className="mt-2 flex-row items-center gap-1.5">
				<View className="h-[5px] w-[5px] rounded-full bg-accent" />
				<Text className="text-[11.5px] text-muted">
					{t("native.credits.betaNote")}
				</Text>
			</View>
		</View>
	);
}
