import {
  Alert as HeroAlert,
  useAlert as useHeroAlert,
  type AlertContentProps,
  type AlertDescriptionProps,
  type AlertIconProps,
  type AlertIndicatorProps,
  type AlertRootProps,
  type AlertTitleProps,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppAlertProps = AlertRootProps;
export type AppAlertIndicatorProps = AlertIndicatorProps;
export type AppAlertIconProps = AlertIconProps;
export type AppAlertContentProps = AlertContentProps;
export type AppAlertTitleProps = AlertTitleProps;
export type AppAlertDescriptionProps = AlertDescriptionProps;

const AppAlertRoot = forwardRef<View, AppAlertProps>((props, ref) => (
  <HeroAlert ref={ref} {...props} />
));

AppAlertRoot.displayName = "AppAlert";

export const AppAlert = Object.assign(AppAlertRoot, {
  Indicator: HeroAlert.Indicator,
  Content: HeroAlert.Content,
  Title: HeroAlert.Title,
  Description: HeroAlert.Description,
});

export const useAppAlert = useHeroAlert;
