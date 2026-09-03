import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { WanditIcon, type WanditIconName } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { ICON_STROKE } from "@/shared/lib/brand";

type HubRoundButtonProps = {
	icon: WanditIconName;
	label: string;
	onPress: () => void;
	iconSize?: number;
	/** Spins the icon (refresh in flight). */
	spinning?: boolean;
};

/** 40pt round bordered icon button from the hub headers (CSV, refresh). */
export function HubRoundButton({
	icon,
	label,
	onPress,
	iconSize = 16,
	spinning = false,
}: HubRoundButtonProps) {
	const { isDark } = useAppTheme();
	const iconStroke = isDark ? ICON_STROKE.dark : ICON_STROKE.light;

	const glyph = <WanditIcon name={icon} size={iconSize} color={iconStroke} />;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			className="h-10 w-10 items-center justify-center rounded-full border border-border bg-surface active:scale-[0.93] dark:bg-surface-secondary"
		>
			{spinning ? (
				<Animated.View
					style={{
						animationName: {
							from: { transform: [{ rotate: "0deg" }] },
							to: { transform: [{ rotate: "360deg" }] },
						},
						animationDuration: "900ms",
						animationIterationCount: "infinite",
						animationTimingFunction: "linear",
					}}
				>
					{glyph}
				</Animated.View>
			) : (
				<View>{glyph}</View>
			)}
		</Pressable>
	);
}
