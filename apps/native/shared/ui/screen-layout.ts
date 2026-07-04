import { HeaderHeightContext } from "@react-navigation/elements";
import { useContext } from "react";
import { Platform, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type TopInsetMode = "safe-area" | "none" | "header";

export type ScreenInsetProps = {
  topInsetMode?: TopInsetMode;
  includeTopInset?: boolean;
  includeBottomInset?: boolean;
  topSpacing?: number;
  bottomSpacing?: number;
};

export const DEFAULT_SCREEN_CONTENT_CLASS_NAME = "px-6";
export const DEFAULT_SCREEN_BOTTOM_SPACING = 24;
export const DEFAULT_SCREEN_KEYBOARD_VERTICAL_OFFSET =
  Platform.select({
    ios: 12,
    android: 0,
  }) ?? 0;

function resolveTopInset({
  topInsetMode,
  includeTopInset = true,
  safeAreaTop,
  headerHeight,
}: {
  topInsetMode?: TopInsetMode;
  includeTopInset?: boolean;
  safeAreaTop: number;
  headerHeight?: number;
}) {
  const resolvedTopInsetMode =
    topInsetMode ?? (includeTopInset === false ? "none" : "safe-area");

  switch (resolvedTopInsetMode) {
    case "none":
      return 0;
    case "header":
      return headerHeight ?? safeAreaTop;
    case "safe-area":
    default:
      return safeAreaTop;
  }
}

export function useScreenInsetStyle({
  topInsetMode,
  includeTopInset = true,
  includeBottomInset = true,
  topSpacing = 0,
  bottomSpacing = DEFAULT_SCREEN_BOTTOM_SPACING,
}: ScreenInsetProps): ViewStyle {
  const insets = useSafeAreaInsets();
  const headerHeight = useContext(HeaderHeightContext);
  const topInset = resolveTopInset({
    topInsetMode,
    includeTopInset,
    safeAreaTop: insets.top,
    headerHeight,
  });

  return {
    paddingTop: topSpacing + topInset,
    paddingBottom: bottomSpacing + (includeBottomInset ? insets.bottom : 0),
  };
}
