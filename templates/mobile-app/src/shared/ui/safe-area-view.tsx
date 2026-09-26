/**
 * Safe-area view that takes Uniwind class names.
 * Screen uses it; a full-screen layout that skips Screen uses it directly.
 * Uniwind styles only its own core components, so withUniwind adds `className`.
 */
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

/** Pads its content by the device insets (notch, home bar). `edges` picks the sides. */
export const AppSafeAreaView = withUniwind(SafeAreaView);
