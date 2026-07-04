import { cn } from "heroui-native";
import type { PropsWithChildren } from "react";
import { Platform, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import {
  KeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
} from "react-native-keyboard-controller";

import {
  DEFAULT_SCREEN_CONTENT_CLASS_NAME,
  DEFAULT_SCREEN_KEYBOARD_VERTICAL_OFFSET,
  type ScreenInsetProps,
  useScreenInsetStyle,
} from "@/shared/ui/screen-layout";

type ScreenProps = PropsWithChildren<
  ViewProps &
    ScreenInsetProps & {
      className?: string;
      contentClassName?: string;
      contentStyle?: StyleProp<ViewStyle>;
      keyboardEnabled?: boolean;
      keyboardBehavior?: KeyboardAvoidingViewProps["behavior"];
      keyboardVerticalOffset?: number;
    }
>;

export function Screen({
  children,
  className,
  contentClassName,
  contentStyle,
  style,
  topInsetMode,
  includeTopInset,
  includeBottomInset,
  topSpacing,
  bottomSpacing,
  keyboardEnabled = false,
  keyboardBehavior = Platform.OS === "ios" ? "padding" : "height",
  keyboardVerticalOffset = DEFAULT_SCREEN_KEYBOARD_VERTICAL_OFFSET,
  ...props
}: ScreenProps) {
  const insetStyle = useScreenInsetStyle({
    topInsetMode,
    includeTopInset,
    includeBottomInset,
    topSpacing,
    bottomSpacing,
  });

  const content = (
    <View className={cn("flex-1 bg-background", className)} style={[insetStyle, style]} {...props}>
      <View
        className={cn("flex-1", DEFAULT_SCREEN_CONTENT_CLASS_NAME, contentClassName)}
        style={contentStyle}
      >
        {children}
      </View>
    </View>
  );

  if (!keyboardEnabled) {
    return content;
  }

  return (
    <KeyboardAvoidingView
      behavior={keyboardBehavior}
      className="flex-1"
      enabled={keyboardEnabled}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {content}
    </KeyboardAvoidingView>
  );
}
