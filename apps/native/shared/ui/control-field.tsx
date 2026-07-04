import {
  ControlField as HeroControlField,
  useControlField as useHeroControlField,
  type ControlFieldIndicatorProps,
  type ControlFieldProps,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppControlFieldProps = ControlFieldProps;
export type AppControlFieldIndicatorProps = ControlFieldIndicatorProps;
export type AppControlFieldContextValue = ReturnType<typeof useHeroControlField>;
export type AppControlFieldRef = View;
export type AppControlFieldIndicatorRef = View;

const AppControlFieldRoot = forwardRef<
  AppControlFieldRef,
  AppControlFieldProps
>((props, ref) => <HeroControlField ref={ref} {...props} />);

AppControlFieldRoot.displayName = "AppControlField";

export const AppControlField = Object.assign(AppControlFieldRoot, {
  Indicator: HeroControlField.Indicator,
});

export const useAppControlField = useHeroControlField;
