import { cn, useThemeColor } from "heroui-native";
import { Text, View } from "react-native";

import { WanditIcon } from "./wandit-icon";

type WordmarkProps = {
	/** "lg" = welcome hero (17/21px), "md" = app bars (15/18px). */
	size?: "md" | "lg";
};

export function Wordmark({ size = "md" }: WordmarkProps) {
	const accent = useThemeColor("accent");
	const isLg = size === "lg";

	return (
		<View
			className={cn("flex-row items-center", isLg ? "gap-[7px]" : "gap-1.5")}
		>
			<WanditIcon name="spark" size={isLg ? 17 : 15} color={accent} />
			<Text
				className={cn(
					"font-display text-foreground",
					isLg
						? "text-[21px] tracking-[-0.42px]"
						: "text-[18px] tracking-[-0.36px]",
				)}
			>
				wandit
			</Text>
		</View>
	);
}
