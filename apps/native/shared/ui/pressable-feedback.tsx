import {
  PressableFeedback as HeroPressableFeedback,
  type PressableFeedbackHighlightAnimation,
  type PressableFeedbackHighlightProps,
  type PressableFeedbackProps,
  type PressableFeedbackRippleAnimation,
  type PressableFeedbackRippleProps,
  type PressableFeedbackRootAnimation,
  type PressableFeedbackRootAnimationContextValue,
  type PressableFeedbackScaleAnimation,
  type PressableFeedbackScaleProps,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppPressableFeedbackProps = PressableFeedbackProps;
export type AppPressableFeedbackScaleProps = PressableFeedbackScaleProps;
export type AppPressableFeedbackHighlightProps = PressableFeedbackHighlightProps;
export type AppPressableFeedbackRippleProps = PressableFeedbackRippleProps;
export type AppPressableFeedbackRootAnimation = PressableFeedbackRootAnimation;
export type AppPressableFeedbackScaleAnimation =
  PressableFeedbackScaleAnimation;
export type AppPressableFeedbackHighlightAnimation =
  PressableFeedbackHighlightAnimation;
export type AppPressableFeedbackRippleAnimation =
  PressableFeedbackRippleAnimation;
export type AppPressableFeedbackRootAnimationContextValue =
  PressableFeedbackRootAnimationContextValue;
export type AppPressableFeedbackRef = View;
export type AppPressableFeedbackScaleRef = View;
export type AppPressableFeedbackHighlightRef = View;
export type AppPressableFeedbackRippleRef = View;

const AppPressableFeedbackRoot = forwardRef<
  AppPressableFeedbackRef,
  AppPressableFeedbackProps
>((props, ref) => <HeroPressableFeedback ref={ref} {...props} />);

AppPressableFeedbackRoot.displayName = "AppPressableFeedback";

export const AppPressableFeedback = Object.assign(AppPressableFeedbackRoot, {
  Scale: HeroPressableFeedback.Scale,
  Highlight: HeroPressableFeedback.Highlight,
  Ripple: HeroPressableFeedback.Ripple,
});
