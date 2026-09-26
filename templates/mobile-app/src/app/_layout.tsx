/**
 * Root layout. expo-router renders it around every route in src/app.
 * It loads the theme CSS and the Supabase env check first, then the gesture
 * root, the i18n provider, the layout direction, HeroUI Native, and the stack.
 */
import "@/global.css";
// D18: this import throws at start when a Supabase env value is missing.
import "@/lib/supabase";
import { LocaleProvider, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LayoutDirection } from "uniwind";
import { I18nProvider, useT } from "@/i18n";

export default function RootLayout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<I18nProvider>
				<DirectedApp />
			</I18nProvider>
		</GestureHandlerRootView>
	);
}

/**
 * Mirrors the app for Arabic inside the React tree. Expo Go resets the native
 * RTL setting on each project open, so I18nManager alone cannot mirror there.
 */
function DirectedApp() {
	const { dir } = useT();
	const isRtl = dir === "rtl";
	return (
		// HeroUI renders overlays and toasts in its own host, so the direction wraps the provider.
		// Uniwind applies the rtl: and ltr: variants from this context.
		<LayoutDirection rtl={isRtl}>
			{/* Yoga lays out start/end and flex rows from this style. */}
			<View style={{ flex: 1, direction: dir }}>
				{/* HeroUI reads the direction for its gestures and popover alignment. */}
				<HeroUINativeProvider config={{ isRTL: isRtl }}>
					{/* The stack reads it for the swipe-back edge, the push animation, and headers. */}
					<LocaleProvider direction={dir}>
						{/* Screens draw their own title and back button inside Screen. */}
						<Stack screenOptions={{ headerShown: false }} />
					</LocaleProvider>
					<StatusBar style="auto" />
				</HeroUINativeProvider>
			</View>
		</LayoutDirection>
	);
}
