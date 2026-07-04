import type { BottomSheetMethods } from "@gorhom/bottom-sheet/lib/typescript/types";
import {
  BottomSheet as HeroBottomSheet,
  useBottomSheet as useHeroBottomSheet,
  useBottomSheetAnimation as useHeroBottomSheetAnimation,
  useBottomSheetAwareHandlers as useHeroBottomSheetAwareHandlers,
  type BottomSheetCloseProps,
  type BottomSheetContentProps,
  type BottomSheetDescriptionProps,
  type BottomSheetOverlayProps,
  type BottomSheetPortalProps,
  type BottomSheetRootProps,
  type BottomSheetTitleProps,
  type BottomSheetTriggerProps,
} from "heroui-native";
import { forwardRef } from "react";
import type { Text, View } from "react-native";

export type AppBottomSheetProps = BottomSheetRootProps;
export type AppBottomSheetTriggerProps = BottomSheetTriggerProps;
export type AppBottomSheetPortalProps = BottomSheetPortalProps;
export type AppBottomSheetOverlayProps = BottomSheetOverlayProps;
export type AppBottomSheetContentProps = BottomSheetContentProps;
export type AppBottomSheetCloseProps = BottomSheetCloseProps;
export type AppBottomSheetTitleProps = BottomSheetTitleProps;
export type AppBottomSheetDescriptionProps = BottomSheetDescriptionProps;
export type AppBottomSheetRef = View;
export type AppBottomSheetTriggerRef = View;
export type AppBottomSheetOverlayRef = View;
export type AppBottomSheetContentRef = BottomSheetMethods;
export type AppBottomSheetCloseRef = View;
export type AppBottomSheetTitleRef = Text;
export type AppBottomSheetDescriptionRef = Text;

const AppBottomSheetRoot = forwardRef<View, AppBottomSheetProps>((props, ref) => (
  <HeroBottomSheet ref={ref} {...props} />
));

AppBottomSheetRoot.displayName = "AppBottomSheet";

export const AppBottomSheet = Object.assign(AppBottomSheetRoot, {
  Trigger: HeroBottomSheet.Trigger,
  Portal: HeroBottomSheet.Portal,
  Overlay: HeroBottomSheet.Overlay,
  Content: HeroBottomSheet.Content,
  Close: HeroBottomSheet.Close,
  Title: HeroBottomSheet.Title,
  Description: HeroBottomSheet.Description,
});

export const useAppBottomSheet = useHeroBottomSheet;
export const useAppBottomSheetAnimation = useHeroBottomSheetAnimation;
export const useAppBottomSheetAwareHandlers = useHeroBottomSheetAwareHandlers;
