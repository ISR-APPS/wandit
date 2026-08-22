import {
	SkeletonGroup as HeroSkeletonGroup,
	type SkeletonGroupContextValue,
	type SkeletonGroupItemProps,
	type SkeletonGroupRootProps,
} from "heroui-native";

export type AppSkeletonGroupProps = SkeletonGroupRootProps;
export type AppSkeletonGroupItemProps = SkeletonGroupItemProps;
export type AppSkeletonGroupContextValue = SkeletonGroupContextValue;

// HeroUI's default exiting FadeOut keeps unmounting skeleton views alive in
// the native hierarchy while Fabric renumbers siblings, which aborts with
// "Attempt to unmount a view which has a different index" (RN 0.85 +
// reanimated 4). Skeletons swap for real content, so no exit fade is needed.
const noExitAnimation = { exiting: { state: "disabled" } } as const;

function AppSkeletonGroupRoot({ animation, ...props }: AppSkeletonGroupProps) {
	return (
		<HeroSkeletonGroup animation={animation ?? noExitAnimation} {...props} />
	);
}

AppSkeletonGroupRoot.displayName = "AppSkeletonGroup";

export const AppSkeletonGroup = Object.assign(AppSkeletonGroupRoot, {
	Item: HeroSkeletonGroup.Item,
});
