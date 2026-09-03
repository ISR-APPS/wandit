import { useTranslation } from "@wandit/internationalization/react";
import { Text, View } from "react-native";

import { useCreditBalance } from "@/features/credits/api/credits.queries";
import { formatCreditBalance } from "@/features/credits/lib/format-credits";

/** Credits summary card inside the project sheet (light prototype §4.1). */
export function CreditsCard() {
	const { locale, t } = useTranslation();
	const { data } = useCreditBalance();

	return (
		<View className="rounded-[18px] border border-border bg-surface p-3.5">
			<View className="flex-row items-baseline justify-between">
				<Text className="font-sans-bold text-[14px] text-foreground">
					{t("native.credits.title")}
				</Text>
				<Text className="font-mono text-[13px] text-muted">
					{t("native.credits.left", {
						count: data
							? formatCreditBalance(data.settledBalance, locale)
							: "—",
					})}
				</Text>
			</View>
			<View className="mt-2.5 flex-row gap-2">
				<CreditBucket
					label={t("native.credits.bucketPlan")}
					value={
						data ? formatCreditBalance(data.settledPlan, locale) : undefined
					}
				/>
				<CreditBucket
					label={t("native.credits.bucketPromo")}
					value={
						data ? formatCreditBalance(data.settledPromo, locale) : undefined
					}
				/>
				<CreditBucket
					label={t("native.credits.bucketTopup")}
					value={
						data ? formatCreditBalance(data.settledTopup, locale) : undefined
					}
				/>
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

function CreditBucket({ label, value }: { label: string; value?: string }) {
	return (
		<View className="min-w-0 flex-1 rounded-xl bg-surface-secondary px-2.5 py-2 dark:bg-surface-tertiary">
			<Text className="text-[10.5px] text-muted" numberOfLines={1}>
				{label}
			</Text>
			<Text className="mt-0.5 font-mono-semibold text-[12px] text-foreground">
				{value ?? "—"}
			</Text>
		</View>
	);
}
