import {
  Chip as HeroChip,
  useChip as useHeroChip,
  type ChipColor,
  type ChipContextValue,
  type ChipLabelProps,
  type ChipProps,
  type ChipSize,
  type ChipVariant,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppChipProps = ChipProps;
export type AppChipLabelProps = ChipLabelProps;
export type AppChipContextValue = ChipContextValue;
export type AppChipColor = ChipColor;
export type AppChipSize = ChipSize;
export type AppChipVariant = ChipVariant;

const AppChipRoot = forwardRef<View, AppChipProps>((props, ref) => (
  <HeroChip ref={ref} {...props} />
));

AppChipRoot.displayName = "AppChip";

export const AppChip = Object.assign(AppChipRoot, {
  Label: HeroChip.Label,
});

export const useAppChip = useHeroChip;
