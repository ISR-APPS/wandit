import { BlurView, type BlurViewProps } from "expo-blur";
import type { FC } from "react";
import Animated, { type SharedValue, useAnimatedProps } from "react-native-reanimated";

type Props = BlurViewProps & {
  blurIntensity: SharedValue<number>;
};

const AnimatedExpoBlurView = Animated.createAnimatedComponent(BlurView);

export const AnimatedBlurView: FC<Props> = ({ blurIntensity, ...props }) => {
  const animatedProps = useAnimatedProps(() => {
    return {
      intensity: blurIntensity.get(),
    };
  });

  return <AnimatedExpoBlurView animatedProps={animatedProps} {...props} />;
};
