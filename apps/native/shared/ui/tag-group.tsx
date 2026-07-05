import {
	TagGroup as HeroTagGroup,
	type TagGroupContextValue,
	type TagGroupItemLabelProps,
	type TagGroupItemProps,
	type TagGroupItemRemoveButtonProps,
	type TagGroupListProps,
	type TagGroupProps,
	type TagGroupSize,
	type TagGroupVariant,
	type TagKey,
	type TagRemoveButtonIconProps,
	type TagRenderProps,
	useTagGroup as useHeroTagGroup,
	useTagGroupItem as useHeroTagGroupItem,
} from "heroui-native";
import { type ComponentRef, forwardRef } from "react";

export type AppTagGroupProps = TagGroupProps;
export type AppTagGroupListProps = TagGroupListProps;
export type AppTagGroupItemProps = TagGroupItemProps;
export type AppTagGroupItemLabelProps = TagGroupItemLabelProps;
export type AppTagGroupItemRemoveButtonProps = TagGroupItemRemoveButtonProps;
export type AppTagGroupContextValue = TagGroupContextValue;
export type AppTagGroupSize = TagGroupSize;
export type AppTagGroupVariant = TagGroupVariant;
export type AppTagGroupKey = TagKey;
export type AppTagGroupRenderProps = TagRenderProps;
export type AppTagGroupRemoveButtonIconProps = TagRemoveButtonIconProps;
export type AppTagGroupRootContextValue = ReturnType<typeof useHeroTagGroup>;
export type AppTagGroupItemContextValue = ReturnType<
	typeof useHeroTagGroupItem
>;
export type AppTagGroupRef = ComponentRef<typeof HeroTagGroup>;
export type AppTagGroupListRef = ComponentRef<typeof HeroTagGroup.List>;
export type AppTagGroupItemRef = ComponentRef<typeof HeroTagGroup.Item>;
export type AppTagGroupItemLabelRef = ComponentRef<
	typeof HeroTagGroup.ItemLabel
>;
export type AppTagGroupItemRemoveButtonRef = ComponentRef<
	typeof HeroTagGroup.ItemRemoveButton
>;

const AppTagGroupRoot = forwardRef<AppTagGroupRef, AppTagGroupProps>(
	(props, ref) => <HeroTagGroup ref={ref} {...props} />,
);

AppTagGroupRoot.displayName = "AppTagGroup";

export const AppTagGroup = Object.assign(AppTagGroupRoot, {
	List: HeroTagGroup.List,
	Item: HeroTagGroup.Item,
	ItemLabel: HeroTagGroup.ItemLabel,
	ItemRemoveButton: HeroTagGroup.ItemRemoveButton,
});

export const useAppTagGroup = useHeroTagGroup;
export const useAppTagGroupItem = useHeroTagGroupItem;
