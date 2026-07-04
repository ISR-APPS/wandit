import { useSelect, useSelectAnimation } from "heroui-native";
import { Pressable, StyleSheet } from "react-native";
import { interpolate, useDerivedValue } from "react-native-reanimated";

import { useAppTheme } from "@/shared/contexts/app-theme-context";
import { AnimatedBlurView } from "@/shared/ui/animated-blur-view";

type Props = {
  maxIntensity?: number;
};

export function SelectBlurBackdrop({ maxIntensity }: Props) {
  const { isDark } = useAppTheme();
  const { onOpenChange } = useSelect();
  const { progress, isDragging, isGestureReleaseAnimationRunning } = useSelectAnimation();

  const blurIntensity = useDerivedValue(() => {
    const intensity = maxIntensity ?? (isDark ? 75 : 50);

    if ((isDragging.get() || isGestureReleaseAnimationRunning.get()) && progress.get() <= 1) {
      return intensity;
    }

    return interpolate(progress.get(), [0, 1, 2], [0, intensity, 0]);
  });

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => onOpenChange(false)}>
      <AnimatedBlurView
        blurIntensity={blurIntensity}
        style={StyleSheet.absoluteFill}
        tint={isDark ? "dark" : "light"}
      />
    </Pressable>
  );
}
