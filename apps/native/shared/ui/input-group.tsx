import {
  InputGroup as HeroInputGroup,
  type InputGroupContextType,
  type InputGroupInputProps,
  type InputGroupPrefixProps,
  type InputGroupProps,
  type InputGroupSuffixProps,
} from "heroui-native";
import { forwardRef } from "react";
import type { TextInput, View } from "react-native";

export type AppInputGroupProps = InputGroupProps;
export type AppInputGroupPrefixProps = InputGroupPrefixProps;
export type AppInputGroupSuffixProps = InputGroupSuffixProps;
export type AppInputGroupInputProps = InputGroupInputProps;
export type AppInputGroupContextType = InputGroupContextType;
export type AppInputGroupRef = View;
export type AppInputGroupPrefixRef = View;
export type AppInputGroupSuffixRef = View;
export type AppInputGroupInputRef = TextInput;

const AppInputGroupRoot = forwardRef<
  AppInputGroupRef,
  AppInputGroupProps
>((props, ref) => <HeroInputGroup ref={ref} {...props} />);

AppInputGroupRoot.displayName = "AppInputGroup";

export const AppInputGroup = Object.assign(AppInputGroupRoot, {
  Prefix: HeroInputGroup.Prefix,
  Suffix: HeroInputGroup.Suffix,
  Input: HeroInputGroup.Input,
});
