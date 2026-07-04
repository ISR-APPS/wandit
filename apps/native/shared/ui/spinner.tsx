import {
  Spinner as HeroSpinner,
  type SpinnerColor,
  type SpinnerContextValue,
  type SpinnerIconProps,
  type SpinnerIndicatorProps,
  type SpinnerProps,
  type SpinnerSize,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppSpinnerProps = SpinnerProps;
export type AppSpinnerIndicatorProps = SpinnerIndicatorProps;
export type AppSpinnerIconProps = SpinnerIconProps;
export type AppSpinnerSize = SpinnerSize;
export type AppSpinnerColor = SpinnerColor;
export type AppSpinnerContextValue = SpinnerContextValue;
export type AppSpinnerAnimation = SpinnerProps["animation"];
export type AppSpinnerIndicatorAnimation = SpinnerIndicatorProps["animation"];
export type AppSpinnerRef = View;
export type AppSpinnerIndicatorRef = View;

const AppSpinnerRoot = forwardRef<AppSpinnerRef, AppSpinnerProps>(
  (props, ref) => <HeroSpinner ref={ref} {...props} />,
);

AppSpinnerRoot.displayName = "AppSpinner";

export const AppSpinner = Object.assign(AppSpinnerRoot, {
  Indicator: HeroSpinner.Indicator,
});
