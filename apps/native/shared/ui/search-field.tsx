import {
  SearchField as HeroSearchField,
  useSearchField as useHeroSearchField,
  type SearchFieldClearButtonIconProps,
  type SearchFieldClearButtonProps,
  type SearchFieldContextType,
  type SearchFieldGroupProps,
  type SearchFieldInputProps,
  type SearchFieldProps,
  type SearchFieldSearchIconIconProps,
  type SearchFieldSearchIconProps,
} from "heroui-native";
import { forwardRef } from "react";
import type { TextInput, View } from "react-native";

export type AppSearchFieldProps = SearchFieldProps;
export type AppSearchFieldContextType = SearchFieldContextType;
export type AppSearchFieldGroupProps = SearchFieldGroupProps;
export type AppSearchFieldSearchIconProps = SearchFieldSearchIconProps;
export type AppSearchFieldSearchIconIconProps =
  SearchFieldSearchIconIconProps;
export type AppSearchFieldInputProps = SearchFieldInputProps;
export type AppSearchFieldClearButtonProps = SearchFieldClearButtonProps;
export type AppSearchFieldClearButtonIconProps =
  SearchFieldClearButtonIconProps;
export type AppSearchFieldRef = View;
export type AppSearchFieldGroupRef = View;
export type AppSearchFieldSearchIconRef = View;
export type AppSearchFieldInputRef = TextInput;
export type AppSearchFieldClearButtonRef = View;

const AppSearchFieldRoot = forwardRef<
  AppSearchFieldRef,
  AppSearchFieldProps
>((props, ref) => <HeroSearchField ref={ref} {...props} />);

AppSearchFieldRoot.displayName = "AppSearchField";

export const AppSearchField = Object.assign(AppSearchFieldRoot, {
  Group: HeroSearchField.Group,
  SearchIcon: HeroSearchField.SearchIcon,
  Input: HeroSearchField.Input,
  ClearButton: HeroSearchField.ClearButton,
});

export const useAppSearchField = useHeroSearchField;
