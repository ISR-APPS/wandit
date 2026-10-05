/**
 * App skeleton: the loading placeholder of content that has a known shape.
 * Screens use these exports, not the HeroUI ones, so the loading look of
 * every screen changes in this one file.
 */
import { Skeleton, SkeletonGroup } from "heroui-native";

/** One shimmer block. Give it the size and the corners of the content, for example `h-4 w-32 rounded-md`. */
export const AppSkeleton = Skeleton;

/**
 * Several blocks that shimmer together. Put `AppSkeletonGroup.Item` blocks
 * inside; `isSkeletonOnly` hides the group when `isLoading` is false.
 */
export const AppSkeletonGroup = SkeletonGroup;
