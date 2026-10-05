/**
 * The font files of the app. The root layout loads them with `useFonts` before the first screen.
 * Each key is a family name. The `--font-*` tokens in src/global.css name these keys.
 * A design world replaces these imports with its own font pair (design-worlds-mobile skill).
 */
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";

/**
 * Family name to font file. React Native needs one family per weight, so each weight is a key.
 * Import each weight from its own path: the package root bundles every weight of the family.
 */
export const appFonts = {
	PlusJakartaSans_400Regular,
	PlusJakartaSans_500Medium,
	PlusJakartaSans_600SemiBold,
	PlusJakartaSans_700Bold,
	PlusJakartaSans_800ExtraBold,
};
