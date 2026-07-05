import {
	Toast as HeroToast,
	type ToastActionProps,
	type ToastCloseProps,
	type ToastComponentProps,
	type ToastContextValue,
	type ToastDescriptionProps,
	type ToasterContextValue,
	type ToastGlobalConfig,
	type ToastInsets,
	type ToastManager,
	type ToastPlacement,
	type ToastProviderProps,
	type ToastRootAnimation,
	type ToastRootProps,
	type ToastRootRef,
	type ToastShowConfig,
	type ToastShowOptions,
	type ToastShowOptionsWithComponent,
	type ToastTitleProps,
	type ToastVariant,
	useToast as useHeroToast,
	useToastConfig as useHeroToastConfig,
} from "heroui-native";
import { type ComponentRef, forwardRef } from "react";

export type AppToastProps = ToastRootProps;
export type AppToastTitleProps = ToastTitleProps;
export type AppToastDescriptionProps = ToastDescriptionProps;
export type AppToastActionProps = ToastActionProps;
export type AppToastCloseProps = ToastCloseProps;
export type AppToastVariant = ToastVariant;
export type AppToastPlacement = ToastPlacement;
export type AppToastRootAnimation = ToastRootAnimation;
export type AppToastContextValue = ToastContextValue;
export type AppToastComponentProps = ToastComponentProps;
export type AppToastGlobalConfig = ToastGlobalConfig;
export type AppToastInsets = ToastInsets;
export type AppToastProviderProps = ToastProviderProps;
export type AppToastShowConfig = ToastShowConfig;
export type AppToastShowOptions = ToastShowOptions;
export type AppToastShowOptionsWithComponent = ToastShowOptionsWithComponent;
export type AppToastManager = ToastManager;
export type AppToasterContextValue = ToasterContextValue;
export type AppToastRef = ToastRootRef;
export type AppToastTitleRef = ComponentRef<typeof HeroToast.Title>;
export type AppToastDescriptionRef = ComponentRef<typeof HeroToast.Description>;
export type AppToastActionRef = ComponentRef<typeof HeroToast.Action>;
export type AppToastCloseRef = ComponentRef<typeof HeroToast.Close>;

const AppToastRoot = forwardRef<AppToastRef, AppToastProps>((props, ref) => (
	<HeroToast ref={ref} {...props} />
));

AppToastRoot.displayName = "AppToast";

export const AppToast = Object.assign(AppToastRoot, {
	Title: HeroToast.Title,
	Description: HeroToast.Description,
	Action: HeroToast.Action,
	Close: HeroToast.Close,
});

export const useAppToast = useHeroToast;
export const useAppToastConfig = useHeroToastConfig;
