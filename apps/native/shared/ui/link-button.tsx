import {
  LinkButton as HeroLinkButton,
  type LinkButtonLabelProps,
  type LinkButtonProps,
} from "heroui-native";
import { forwardRef } from "react";
import type { Text, View } from "react-native";

export type AppLinkButtonProps = LinkButtonProps;
export type AppLinkButtonLabelProps = LinkButtonLabelProps;
export type AppLinkButtonRef = View;
export type AppLinkButtonLabelRef = Text;

const AppLinkButtonRoot = forwardRef<
  AppLinkButtonRef,
  AppLinkButtonProps
>((props, ref) => <HeroLinkButton ref={ref} {...props} />);

AppLinkButtonRoot.displayName = "AppLinkButton";

export const AppLinkButton = Object.assign(AppLinkButtonRoot, {
  Label: HeroLinkButton.Label,
});
