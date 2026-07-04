import { HeaderHeightContext } from "@react-navigation/elements";
import { cn } from "heroui-native";
import { useContext, type PropsWithChildren } from "react";
import { View, type ViewProps } from "react-native";
import Animated, { type AnimatedProps } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type TopInsetMode } from "@/shared/ui/screen-layout";

const AnimatedView = Animated.createAnimatedComponent(View);

type Props = AnimatedProps<ViewProps> & {
  className?: string;
  topInsetMode?: TopInsetMode;
};

export function SafeAreaView({
  children,
  className,
  style,
  topInsetMode = "header",
  ...props
}: PropsWithChildren<Props>) {
  const insets = useSafeAreaInsets();
  const headerHeight = useContext(HeaderHeightContext);
  const topInset =
    topInsetMode === "none"
      ? 0
      : topInsetMode === "safe-area"
        ? insets.top
        : headerHeight ?? insets.top;

  return (
    <AnimatedView
      className={cn("bg-background", className)}
      style={[
        {
          paddingTop: topInset,
          paddingBottom: insets.bottom + 32,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </AnimatedView>
  );
}
