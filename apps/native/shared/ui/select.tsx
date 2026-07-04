import {
  Select as HeroSelect,
  useSelect as useHeroSelect,
  useSelectAnimation as useHeroSelectAnimation,
  useSelectItem as useHeroSelectItem,
  type SelectAlign,
  type SelectCloseProps,
  type SelectContentProps,
  type SelectItemDescriptionProps,
  type SelectItemIndicatorIconProps,
  type SelectItemIndicatorProps,
  type SelectItemLabelProps,
  type SelectItemProps,
  type SelectListLabelProps,
  type SelectOverlayProps,
  type SelectPlacement,
  type SelectPortalProps,
  type SelectRootProps,
  type SelectTriggerIndicatorAnimation,
  type SelectTriggerIndicatorIconProps,
  type SelectTriggerIndicatorProps,
  type SelectTriggerProps,
  type SelectTriggerRef,
  type SelectValueProps,
} from "heroui-native";

export type AppSelectProps<Mode extends "single" | "multiple" = "single"> =
  SelectRootProps<Mode>;
export type AppSelectTriggerProps = SelectTriggerProps;
export type AppSelectValueProps = SelectValueProps;
export type AppSelectTriggerIndicatorProps = SelectTriggerIndicatorProps;
export type AppSelectPortalProps = SelectPortalProps;
export type AppSelectOverlayProps = SelectOverlayProps;
export type AppSelectContentProps = SelectContentProps;
export type AppSelectCloseProps = SelectCloseProps;
export type AppSelectListLabelProps = SelectListLabelProps;
export type AppSelectItemProps = SelectItemProps;
export type AppSelectItemLabelProps = SelectItemLabelProps;
export type AppSelectItemDescriptionProps = SelectItemDescriptionProps;
export type AppSelectItemIndicatorProps = SelectItemIndicatorProps;
export type AppSelectItemIndicatorIconProps = SelectItemIndicatorIconProps;
export type AppSelectPlacement = SelectPlacement;
export type AppSelectAlign = SelectAlign;
export type AppSelectTriggerRef = SelectTriggerRef;
export type AppSelectTriggerIndicatorAnimation =
  SelectTriggerIndicatorAnimation;
export type AppSelectTriggerIndicatorIconProps =
  SelectTriggerIndicatorIconProps;

export const AppSelect = HeroSelect;
export const useAppSelect = useHeroSelect;
export const useAppSelectAnimation = useHeroSelectAnimation;
export const useAppSelectItem = useHeroSelectItem;
