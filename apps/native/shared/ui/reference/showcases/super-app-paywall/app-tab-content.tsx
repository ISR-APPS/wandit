import { Checkbox, ControlField, cn } from "heroui-native";
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "../../../contexts/app-theme-context";
import { AppText } from "../../app-text";

export function AppTabContent() {
	const { isDark } = useAppTheme();

	return (
		<View
			className="overflow-hidden rounded-3xl border-2 border-yellow-500"
			style={styles.formField}
		>
			<ControlField
				isSelected
				className={cn("bg-neutral-50 px-5 py-4", isDark && "bg-neutral-900")}
			>
				<View className="gap-2">
					<View className="flex-row items-center gap-3">
						<ControlField.Indicator>
							<Checkbox className="size-6 rounded-full">
								<Checkbox.Indicator
									className="bg-yellow-500"
									iconProps={{
										size: 16,
										color: "white",
									}}
									animation={{
										translateX: { value: [0, 0] },
									}}
								/>
							</Checkbox>
						</ControlField.Indicator>
						<AppText className="font-black text-foreground text-lg">
							Lifetime
						</AppText>
					</View>
					<AppText className="font-medium text-base text-foreground/80">
						$14.99 one-time purchase
					</AppText>
				</View>
			</ControlField>
		</View>
	);
}

const styles = StyleSheet.create({
	formField: {
		borderCurve: "continuous",
	},
});
