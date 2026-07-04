import { Input as HeroInput, type InputProps } from "heroui-native";
import { forwardRef } from "react";
import type { TextInput } from "react-native";

export type AppInputProps = InputProps;
export type AppInputRef = TextInput;

const AppInputRoot = forwardRef<AppInputRef, AppInputProps>((props, ref) => (
  <HeroInput ref={ref} {...props} />
));

AppInputRoot.displayName = "AppInput";

export const AppInput = AppInputRoot;
