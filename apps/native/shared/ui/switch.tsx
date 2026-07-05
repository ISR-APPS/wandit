import {
	Switch as HeroSwitch,
	type SwitchAnimationContextValue,
	type SwitchContentProps,
	type SwitchContextValue,
	type SwitchProps,
	type SwitchRenderProps,
	type SwitchRootAnimation,
	type SwitchThumbAnimation,
	type SwitchThumbProps,
	useSwitch as useHeroSwitch,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppSwitchProps = SwitchProps;
export type AppSwitchThumbProps = SwitchThumbProps;
export type AppSwitchStartContentProps = SwitchContentProps;
export type AppSwitchEndContentProps = SwitchContentProps;
export type AppSwitchRenderProps = SwitchRenderProps;
export type AppSwitchRootAnimation = SwitchRootAnimation;
export type AppSwitchThumbAnimation = SwitchThumbAnimation;
export type AppSwitchContextValue = SwitchContextValue;
export type AppSwitchAnimationContextValue = SwitchAnimationContextValue;
export type AppSwitchRef = View;
export type AppSwitchThumbRef = View;
export type AppSwitchContentRef = View;

const AppSwitchRoot = forwardRef<AppSwitchRef, AppSwitchProps>((props, ref) => (
	<HeroSwitch ref={ref} {...props} />
));

AppSwitchRoot.displayName = "AppSwitch";

export const AppSwitch = Object.assign(AppSwitchRoot, {
	Thumb: HeroSwitch.Thumb,
	StartContent: HeroSwitch.StartContent,
	EndContent: HeroSwitch.EndContent,
});

export const useAppSwitch = useHeroSwitch;
