import {
  RadioGroup as HeroRadioGroup,
  useRadioGroup as useHeroRadioGroup,
  useRadioGroupItem as useHeroRadioGroupItem,
  type RadioGroupItemContextValue,
  type RadioGroupItemProps,
  type RadioGroupItemRenderProps,
  type RadioGroupProps,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppRadioGroupProps = RadioGroupProps;
export type AppRadioGroupItemProps = RadioGroupItemProps;
export type AppRadioGroupItemRenderProps = RadioGroupItemRenderProps;
export type AppRadioGroupItemContextValue = RadioGroupItemContextValue;
export type AppRadioGroupContextValue = ReturnType<typeof useHeroRadioGroup>;
export type AppRadioGroupRef = View;
export type AppRadioGroupItemRef = View;

const AppRadioGroupRoot = forwardRef<
  AppRadioGroupRef,
  AppRadioGroupProps
>((props, ref) => <HeroRadioGroup ref={ref} {...props} />);

AppRadioGroupRoot.displayName = "AppRadioGroup";

export const AppRadioGroup = Object.assign(AppRadioGroupRoot, {
  Item: HeroRadioGroup.Item,
});

export const useAppRadioGroup = useHeroRadioGroup;
export const useAppRadioGroupItem = useHeroRadioGroupItem;
