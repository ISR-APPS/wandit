import { router } from "expo-router";
import { useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WanditIcon } from "@/components/wandit-icon";

type WorkspacePlaceholderProps = {
	title: string;
	description: string;
};

// Temporary stand-in while the project view screens get built out.
// Full-screen route now (views open from the project sheet), so it carries
// its own back pill (dark prototype settings-screen header).
export function WorkspacePlaceholder({
	title,
	description,
}: WorkspacePlaceholderProps) {
	const insets = useSafeAreaInsets();
	const foreground = useThemeColor("foreground");

	return (
		<View className="flex-1 bg-background">
			<View
				className="flex-row items-center px-3.5 pb-1.5"
				style={{ paddingTop: insets.top + 8 }}
			>
				<Pressable
					accessibilityRole="button"
					onPress={() => router.back()}
					className="h-[38px] flex-row items-center gap-[7px] rounded-full border border-border bg-surface ps-3 pe-4 active:scale-95 dark:bg-surface-tertiary/65"
				>
					<View style={{ transform: [{ rotate: "180deg" }] }}>
						<WanditIcon name="arrowRight" size={13} color={foreground} />
					</View>
					<Text className="font-sans-semibold text-[13.5px] text-foreground">
						{title}
					</Text>
				</Pressable>
			</View>
			<View className="flex-1 items-center justify-center gap-2 px-8 pb-16">
				<Text className="font-display-semibold text-[18px] text-foreground">
					{title}
				</Text>
				<Text className="text-center text-[13.5px] text-muted leading-5">
					{description}
				</Text>
			</View>
		</View>
	);
}
