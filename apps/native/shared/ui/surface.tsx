import {
	Surface as HeroSurface,
	type SurfaceRootProps,
	type SurfaceVariant,
	useSurface as useHeroSurface,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppSurfaceProps = SurfaceRootProps;
export type AppSurfaceVariant = SurfaceVariant;
export type AppSurfaceContextValue = ReturnType<typeof useHeroSurface>;
export type AppSurfaceRef = View;

const AppSurfaceRoot = forwardRef<AppSurfaceRef, AppSurfaceProps>(
	(props, ref) => <HeroSurface ref={ref} {...props} />,
);

AppSurfaceRoot.displayName = "AppSurface";

export const AppSurface = AppSurfaceRoot;

export const useAppSurface = useHeroSurface;
