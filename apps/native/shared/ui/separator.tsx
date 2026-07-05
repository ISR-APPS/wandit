import {
	Separator as HeroSeparator,
	type SeparatorOrientation,
	type SeparatorProps,
	type SeparatorVariant,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppSeparatorProps = SeparatorProps;
export type AppSeparatorOrientation = SeparatorOrientation;
export type AppSeparatorVariant = SeparatorVariant;
export type AppSeparatorRef = View;

const AppSeparatorRoot = forwardRef<AppSeparatorRef, AppSeparatorProps>(
	(props, ref) => <HeroSeparator ref={ref} {...props} />,
);

AppSeparatorRoot.displayName = "AppSeparator";

export const AppSeparator = AppSeparatorRoot;
