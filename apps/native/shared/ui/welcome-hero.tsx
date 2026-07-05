import { Ionicons } from "@expo/vector-icons";
import { Card, cn, useThemeColor } from "heroui-native";
import { View, type ViewProps } from "react-native";

import { AppText } from "@/shared/ui/app-text";

type FitCalWelcomeHeroProps = ViewProps;

export function FitCalWelcomeHero({
	className,
	style,
	...props
}: FitCalWelcomeHeroProps) {
	const accent = useThemeColor("accent");

	return (
		<Card
			animation="disable-all"
			className={cn(
				"justify-end overflow-hidden rounded-[26px] border-0 bg-accent p-6",
				className,
			)}
			style={[{ height: 341 }, style]}
			variant="transparent"
			{...props}
		>
			<View className="absolute top-6 right-6 h-12 w-12 items-center justify-center rounded-full bg-foreground">
				<Ionicons name="flash" size={23} color={accent} />
			</View>

			<View className="absolute top-6 left-6 gap-1">
				<View className="h-2 w-[54px] rounded-full bg-foreground/90" />
				<View className="h-2 w-[38px] rounded-full bg-foreground/50" />
				<View className="h-2 w-[46px] rounded-full bg-foreground/30" />
			</View>

			<View className="rounded-[16px] bg-foreground px-4 py-[14px]">
				<AppText
					allowFontScaling={false}
					className="font-bold text-[12px] text-accent uppercase leading-4"
				>
					Today · Day 12
				</AppText>
				<AppText
					allowFontScaling={false}
					className="mt-0.5 font-extrabold text-[20px] text-background leading-[25px]"
				>
					Push Day · 6 exercises
				</AppText>
			</View>
		</Card>
	);
}
