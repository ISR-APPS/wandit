import {
	Checkbox as HeroCheckbox,
	useCheckbox as useHeroCheckbox,
} from "heroui-native";
import { type ComponentPropsWithoutRef, forwardRef } from "react";
import type { View } from "react-native";

export type AppCheckboxProps = ComponentPropsWithoutRef<typeof HeroCheckbox>;
export type AppCheckboxIndicatorProps = ComponentPropsWithoutRef<
	typeof HeroCheckbox.Indicator
>;
export type AppCheckboxRef = View;
export type AppCheckboxIndicatorRef = View;

const AppCheckboxRoot = forwardRef<AppCheckboxRef, AppCheckboxProps>(
	(props, ref) => <HeroCheckbox ref={ref} {...props} />,
);

AppCheckboxRoot.displayName = "AppCheckbox";

export const AppCheckbox = Object.assign(AppCheckboxRoot, {
	Indicator: HeroCheckbox.Indicator,
});

export const useAppCheckbox = useHeroCheckbox;
