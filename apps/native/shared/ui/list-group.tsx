import {
  ListGroup as HeroListGroup,
  type ListGroupIconProps,
  type ListGroupItemContentProps,
  type ListGroupItemDescriptionProps,
  type ListGroupItemPrefixProps,
  type ListGroupItemProps,
  type ListGroupItemSuffixProps,
  type ListGroupItemTitleProps,
  type ListGroupRootProps,
} from "heroui-native";
import { forwardRef } from "react";
import type { Text, View } from "react-native";

export type AppListGroupProps = ListGroupRootProps;
export type AppListGroupItemProps = ListGroupItemProps;
export type AppListGroupIconProps = ListGroupIconProps;
export type AppListGroupItemPrefixProps = ListGroupItemPrefixProps;
export type AppListGroupItemContentProps = ListGroupItemContentProps;
export type AppListGroupItemTitleProps = ListGroupItemTitleProps;
export type AppListGroupItemDescriptionProps = ListGroupItemDescriptionProps;
export type AppListGroupItemSuffixProps = ListGroupItemSuffixProps;
export type AppListGroupRef = View;
export type AppListGroupItemRef = View;
export type AppListGroupItemPrefixRef = View;
export type AppListGroupItemContentRef = View;
export type AppListGroupItemTitleRef = Text;
export type AppListGroupItemDescriptionRef = Text;
export type AppListGroupItemSuffixRef = View;

const AppListGroupRoot = forwardRef<AppListGroupRef, AppListGroupProps>(
  (props, ref) => <HeroListGroup ref={ref} {...props} />,
);

AppListGroupRoot.displayName = "AppListGroup";

export const AppListGroup = Object.assign(AppListGroupRoot, {
  Item: HeroListGroup.Item,
  ItemPrefix: HeroListGroup.ItemPrefix,
  ItemContent: HeroListGroup.ItemContent,
  ItemTitle: HeroListGroup.ItemTitle,
  ItemDescription: HeroListGroup.ItemDescription,
  ItemSuffix: HeroListGroup.ItemSuffix,
});
