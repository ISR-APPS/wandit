import {
	Popover as HeroPopover,
	type PopoverAlign,
	type PopoverArrowProps,
	type PopoverCloseProps,
	type PopoverContentProps,
	type PopoverDescriptionProps,
	type PopoverOverlayProps,
	type PopoverPlacement,
	type PopoverPortalProps,
	type PopoverRootProps,
	type PopoverTitleProps,
	type PopoverTriggerProps,
	type PopoverTriggerRef,
	type UsePopoverAnimationReturn,
	type UsePopoverReturn,
	usePopover as useHeroPopover,
	usePopoverAnimation as useHeroPopoverAnimation,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppPopoverProps = PopoverRootProps;
export type AppPopoverTriggerProps = PopoverTriggerProps;
export type AppPopoverPortalProps = PopoverPortalProps;
export type AppPopoverOverlayProps = PopoverOverlayProps;
export type AppPopoverContentProps = PopoverContentProps;
export type AppPopoverArrowProps = PopoverArrowProps;
export type AppPopoverCloseProps = PopoverCloseProps;
export type AppPopoverTitleProps = PopoverTitleProps;
export type AppPopoverDescriptionProps = PopoverDescriptionProps;
export type AppPopoverPlacement = PopoverPlacement;
export type AppPopoverAlign = PopoverAlign;
export type AppPopoverTriggerRef = PopoverTriggerRef;
export type AppUsePopoverReturn = UsePopoverReturn;
export type AppUsePopoverAnimationReturn = UsePopoverAnimationReturn;

const AppPopoverRoot = forwardRef<View, AppPopoverProps>((props, ref) => (
	<HeroPopover ref={ref} {...props} />
));

AppPopoverRoot.displayName = "AppPopover";

export const AppPopover = Object.assign(AppPopoverRoot, {
	Trigger: HeroPopover.Trigger,
	Portal: HeroPopover.Portal,
	Overlay: HeroPopover.Overlay,
	Content: HeroPopover.Content,
	Arrow: HeroPopover.Arrow,
	Close: HeroPopover.Close,
	Title: HeroPopover.Title,
	Description: HeroPopover.Description,
});

export const useAppPopover = useHeroPopover;
export const useAppPopoverAnimation = useHeroPopoverAnimation;
