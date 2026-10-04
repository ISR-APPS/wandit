/**
 * App icon: Ionicons from @expo/vector-icons, which run in Expo Go and on the web.
 * Screens set the color with `colorClassName`, for example `accent-muted`,
 * so the icon follows light and dark mode. Icon names: https://icons.expo.fyi.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { withUniwind } from "uniwind";

/** An Ionicons name, for example `home-outline`. The filled name has no suffix. */
export type AppIconName = ComponentProps<typeof Ionicons>["name"];

/** Ionicons with `colorClassName`. A `color` prop wins over the class. */
export const AppIcon = withUniwind(Ionicons);
