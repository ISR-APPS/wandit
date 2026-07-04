import {
  CloseButton as HeroCloseButton,
  type CloseButtonIconProps,
  type CloseButtonProps,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppCloseButtonProps = CloseButtonProps;
export type AppCloseButtonIconProps = CloseButtonIconProps;
export type AppCloseButtonRef = View;

export const AppCloseButton = forwardRef<
  AppCloseButtonRef,
  AppCloseButtonProps
>((props, ref) => <HeroCloseButton ref={ref} {...props} />);

AppCloseButton.displayName = "AppCloseButton";
