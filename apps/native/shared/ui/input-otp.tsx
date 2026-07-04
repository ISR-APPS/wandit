import {
  InputOTP as HeroInputOTP,
  REGEXP_ONLY_CHARS,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
  useInputOTP as useHeroInputOTP,
  type InputOTPGroupProps,
  type InputOTPGroupRef,
  type InputOTPGroupRenderProps,
  type InputOTPRef,
  type InputOTPRootProps,
  type InputOTPSeparatorProps,
  type InputOTPSeparatorRef,
  type InputOTPSlotCaretAnimation,
  type InputOTPSlotCaretProps,
  type InputOTPSlotCaretRef,
  type InputOTPSlotContextValue,
  type InputOTPSlotPlaceholderProps,
  type InputOTPSlotPlaceholderRef,
  type InputOTPSlotProps,
  type InputOTPSlotRef,
  type InputOTPSlotValueAnimation,
  type InputOTPSlotValueProps,
  type InputOTPSlotValueRef,
} from "heroui-native";
import { forwardRef } from "react";

export type AppInputOTPProps = InputOTPRootProps;
export type AppInputOTPRef = InputOTPRef;
export type AppInputOTPGroupProps = InputOTPGroupProps;
export type AppInputOTPGroupRef = InputOTPGroupRef;
export type AppInputOTPGroupRenderProps = InputOTPGroupRenderProps;
export type AppInputOTPSlotProps = InputOTPSlotProps;
export type AppInputOTPSlotRef = InputOTPSlotRef;
export type AppInputOTPSlotContextValue = InputOTPSlotContextValue;
export type AppInputOTPSlotPlaceholderProps = InputOTPSlotPlaceholderProps;
export type AppInputOTPSlotPlaceholderRef = InputOTPSlotPlaceholderRef;
export type AppInputOTPSlotValueAnimation = InputOTPSlotValueAnimation;
export type AppInputOTPSlotValueProps = InputOTPSlotValueProps;
export type AppInputOTPSlotValueRef = InputOTPSlotValueRef;
export type AppInputOTPSlotCaretAnimation = InputOTPSlotCaretAnimation;
export type AppInputOTPSlotCaretProps = InputOTPSlotCaretProps;
export type AppInputOTPSlotCaretRef = InputOTPSlotCaretRef;
export type AppInputOTPSeparatorProps = InputOTPSeparatorProps;
export type AppInputOTPSeparatorRef = InputOTPSeparatorRef;

const AppInputOTPRoot = forwardRef<AppInputOTPRef, AppInputOTPProps>(
  (props, ref) => <HeroInputOTP ref={ref} {...props} />,
);

AppInputOTPRoot.displayName = "AppInputOTP";

export const AppInputOTP = Object.assign(AppInputOTPRoot, {
  Group: HeroInputOTP.Group,
  Slot: HeroInputOTP.Slot,
  SlotPlaceholder: HeroInputOTP.SlotPlaceholder,
  SlotValue: HeroInputOTP.SlotValue,
  SlotCaret: HeroInputOTP.SlotCaret,
  Separator: HeroInputOTP.Separator,
});

export const APP_INPUT_OTP_REGEXP_ONLY_CHARS = REGEXP_ONLY_CHARS;
export const APP_INPUT_OTP_REGEXP_ONLY_DIGITS = REGEXP_ONLY_DIGITS;
export const APP_INPUT_OTP_REGEXP_ONLY_DIGITS_AND_CHARS =
  REGEXP_ONLY_DIGITS_AND_CHARS;

export const useAppInputOTP = useHeroInputOTP;
