import type { BlurViewProps } from "expo-blur";
import type { PressableProps } from "react-native";
import { Pressable, StyleSheet } from "react-native";
import { interpolate, useDerivedValue } from "react-native-reanimated";

import { useAppTheme } from "@/shared/contexts/app-theme-context";
import { AnimatedBlurView } from "@/shared/ui/animated-blur-view";
import {
	useAppBottomSheet,
	useAppBottomSheetAnimation,
} from "@/shared/ui/bottom-sheet";

export type AppBottomSheetBlurBackdropProps = Omit<PressableProps, "style"> & {
	maxIntensity?: number;
	tint?: BlurViewProps["tint"];
};

export function AppBottomSheetBlurBackdrop({
	maxIntensity,
	onPress,
	pointerEvents,
	tint,
	...props
}: AppBottomSheetBlurBackdropProps) {
	const { isDark } = useAppTheme();
	const { isOpen, onOpenChange } = useAppBottomSheet();
	const { progress } = useAppBottomSheetAnimation();

	const blurIntensity = useDerivedValue(() => {
		const intensity = maxIntensity ?? (isDark ? 75 : 50);

		return interpolate(progress.get(), [0, 1, 2], [0, intensity, 0]);
	});

	return (
		<Pressable
			{...props}
			onPress={(event) => {
				onOpenChange(false);
				onPress?.(event);
			}}
			pointerEvents={pointerEvents ?? (isOpen ? "auto" : "none")}
			style={StyleSheet.absoluteFill}
		>
			<AnimatedBlurView
				blurIntensity={blurIntensity}
				style={StyleSheet.absoluteFill}
				tint={tint ?? (isDark ? "dark" : "light")}
			/>
		</Pressable>
	);
}
