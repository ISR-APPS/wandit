/**
 * App pressable: a pressable area that scales down a little under the finger.
 * Screens use it for pressable cards, tiles, hero blocks, and the data rows that a
 * design world draws. A settings or link row uses AppListGroup.Item instead.
 */
import { PressableFeedback } from "heroui-native";

/**
 * HeroUI PressableFeedback. The design world sets the press depth, for example
 * `animation={{ scale: { value: 0.96 } }}`. Give it `accessibilityRole="button"`.
 */
export const AppPressable = PressableFeedback;
