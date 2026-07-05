import {
	SkeletonGroup as HeroSkeletonGroup,
	type SkeletonGroupContextValue,
	type SkeletonGroupItemProps,
	type SkeletonGroupRootProps,
} from "heroui-native";

export type AppSkeletonGroupProps = SkeletonGroupRootProps;
export type AppSkeletonGroupItemProps = SkeletonGroupItemProps;
export type AppSkeletonGroupContextValue = SkeletonGroupContextValue;

function AppSkeletonGroupRoot(props: AppSkeletonGroupProps) {
	return <HeroSkeletonGroup {...props} />;
}

AppSkeletonGroupRoot.displayName = "AppSkeletonGroup";

export const AppSkeletonGroup = Object.assign(AppSkeletonGroupRoot, {
	Item: HeroSkeletonGroup.Item,
});
