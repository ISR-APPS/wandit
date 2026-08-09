import { cn } from "heroui-native";
import { View, type ViewProps } from "react-native";

import { AppText } from "@/shared/ui/app-text";

type FitCalWordmarkProps = ViewProps;

export function FitCalWordmark({ className, ...props }: FitCalWordmarkProps) {
	return (
		<View className={cn("flex-row items-center", className)} {...props}>
			<AppText
				allowFontScaling={false}
				className="font-extrabold text-[20px] text-foreground leading-6"
			>
				Fitcal
			</AppText>
			<View className="ml-0.5 rounded-[5px] bg-accent px-1 py-0.5">
				<AppText
					allowFontScaling={false}
					className="font-extrabold text-[18px] text-accent-foreground leading-5"
				>
					AI
				</AppText>
			</View>
		</View>
	);
}
