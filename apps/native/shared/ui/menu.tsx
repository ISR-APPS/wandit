import type { BottomSheetMethods } from "@gorhom/bottom-sheet/lib/typescript/types";
import {
	Menu as HeroMenu,
	SubMenu as HeroSubMenu,
	type MenuAlign,
	type MenuAnimationContextValue,
	type MenuCloseProps,
	type MenuContentBottomSheetProps,
	type MenuContentContextValue,
	type MenuContentPopoverProps,
	type MenuContentProps,
	type MenuGroupProps,
	type MenuGroupSelectionMode,
	type MenuItemAnimation,
	type MenuItemDescriptionProps,
	type MenuItemIndicatorIconProps,
	type MenuItemIndicatorProps,
	type MenuItemIndicatorVariant,
	type MenuItemProps,
	type MenuItemRenderProps,
	type MenuItemTitleProps,
	type MenuItemVariant,
	type MenuKey,
	type MenuLabelProps,
	type MenuOverlayProps,
	type MenuPlacement,
	type MenuPortalProps,
	type MenuPresentation,
	type MenuRootProps,
	type MenuTriggerProps,
	type MenuTriggerRef,
	type SubMenuContentProps,
	type SubMenuContentRef,
	type SubMenuRootProps,
	type SubMenuRootRef,
	type SubMenuTriggerProps,
	type SubMenuTriggerRef,
	type UseMenuAnimationReturn,
	type UseMenuReturn,
	useMenu as useHeroMenu,
	useMenuAnimation as useHeroMenuAnimation,
	useMenuItem as useHeroMenuItem,
	useSubMenu as useHeroSubMenu,
} from "heroui-native";
import { type ComponentProps, forwardRef } from "react";
import type { Text, View } from "react-native";

export type AppMenuProps = MenuRootProps;
export type AppMenuTriggerProps = MenuTriggerProps;
export type AppMenuPortalProps = MenuPortalProps;
export type AppMenuOverlayProps = MenuOverlayProps;
export type AppMenuContentProps = MenuContentProps;
export type AppMenuContentPopoverProps = MenuContentPopoverProps;
export type AppMenuContentBottomSheetProps = MenuContentBottomSheetProps;
export type AppMenuCloseProps = MenuCloseProps;
export type AppMenuGroupProps = MenuGroupProps;
export type AppMenuLabelProps = MenuLabelProps;
export type AppMenuItemProps = MenuItemProps;
export type AppMenuItemTitleProps = MenuItemTitleProps;
export type AppMenuItemDescriptionProps = MenuItemDescriptionProps;
export type AppMenuItemIndicatorProps = MenuItemIndicatorProps;
export type AppMenuItemIndicatorIconProps = MenuItemIndicatorIconProps;
export type AppMenuItemIndicatorVariant = MenuItemIndicatorVariant;
export type AppMenuItemAnimation = MenuItemAnimation;
export type AppMenuItemRenderProps = MenuItemRenderProps;
export type AppMenuItemVariant = MenuItemVariant;
export type AppMenuGroupSelectionMode = MenuGroupSelectionMode;
export type AppMenuKey = MenuKey;
export type AppMenuPresentation = MenuPresentation;
export type AppMenuPlacement = MenuPlacement;
export type AppMenuAlign = MenuAlign;
export type AppMenuContentContextValue = MenuContentContextValue;
export type AppMenuAnimationContextValue = MenuAnimationContextValue;
export type AppUseMenuReturn = UseMenuReturn;
export type AppUseMenuAnimationReturn = UseMenuAnimationReturn;
export type AppUseMenuItemReturn = ReturnType<typeof useHeroMenuItem>;
export type AppMenuRef = View;
export type AppMenuTriggerRef = MenuTriggerRef;
export type AppMenuOverlayRef = View;
export type AppMenuContentRef = View | BottomSheetMethods;
export type AppMenuCloseRef = View;
export type AppMenuGroupRef = View;
export type AppMenuLabelRef = Text;
export type AppMenuItemRef = View;
export type AppMenuItemTitleRef = Text;
export type AppMenuItemDescriptionRef = Text;
export type AppMenuItemIndicatorRef = View;

export type AppSubMenuProps = SubMenuRootProps;
export type AppSubMenuTriggerProps = SubMenuTriggerProps;
export type AppSubMenuTriggerIndicatorProps = ComponentProps<
	typeof HeroSubMenu.TriggerIndicator
>;
export type AppSubMenuContentProps = SubMenuContentProps;
export type AppUseSubMenuReturn = ReturnType<typeof useHeroSubMenu>;
export type AppSubMenuRef = SubMenuRootRef;
export type AppSubMenuTriggerRef = SubMenuTriggerRef;
export type AppSubMenuTriggerIndicatorRef = View;
export type AppSubMenuContentRef = SubMenuContentRef;

const AppMenuRoot = forwardRef<View, AppMenuProps>((props, ref) => (
	<HeroMenu ref={ref} {...props} />
));

AppMenuRoot.displayName = "AppMenu";

export const AppMenu = Object.assign(AppMenuRoot, {
	Trigger: HeroMenu.Trigger,
	Portal: HeroMenu.Portal,
	Overlay: HeroMenu.Overlay,
	Content: HeroMenu.Content,
	Close: HeroMenu.Close,
	Group: HeroMenu.Group,
	Label: HeroMenu.Label,
	Item: HeroMenu.Item,
	ItemTitle: HeroMenu.ItemTitle,
	ItemDescription: HeroMenu.ItemDescription,
	ItemIndicator: HeroMenu.ItemIndicator,
});

const AppSubMenuRoot = forwardRef<AppSubMenuRef, AppSubMenuProps>(
	(props, ref) => <HeroSubMenu ref={ref} {...props} />,
);

AppSubMenuRoot.displayName = "AppSubMenu";

export const AppSubMenu = Object.assign(AppSubMenuRoot, {
	Trigger: HeroSubMenu.Trigger,
	TriggerIndicator: HeroSubMenu.TriggerIndicator,
	Content: HeroSubMenu.Content,
});

export const useAppMenu = useHeroMenu;
export const useAppMenuAnimation = useHeroMenuAnimation;
export const useAppMenuItem = useHeroMenuItem;
export const useAppSubMenu = useHeroSubMenu;
