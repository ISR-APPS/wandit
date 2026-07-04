import {
  Label as HeroLabel,
  useLabel as useHeroLabel,
  type LabelContextValue,
  type LabelProps,
  type LabelRef,
  type LabelTextProps,
  type LabelTextRef,
} from "heroui-native";
import { forwardRef } from "react";

export type AppLabelProps = LabelProps;
export type AppLabelTextProps = LabelTextProps;
export type AppLabelContextValue = LabelContextValue;
export type AppLabelRef = LabelRef;
export type AppLabelTextRef = LabelTextRef;

const AppLabelRoot = forwardRef<AppLabelRef, AppLabelProps>((props, ref) => (
  <HeroLabel ref={ref} {...props} />
));

AppLabelRoot.displayName = "AppLabel";

export const AppLabel = Object.assign(AppLabelRoot, {
  Text: HeroLabel.Text,
});

export const useAppLabel = useHeroLabel;
