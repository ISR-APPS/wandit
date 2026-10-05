/**
 * Root layout. expo-router renders it around every route in src/app.
 * It loads the theme CSS and the Supabase env check first, then the gesture
 * root, React Query, i18n, the layout direction, HeroUI Native, the
 * navigation theme, and the root stack: the tabs and the sign-in modal.
 */
import "@/global.css";
// D18: this import throws at start when a Supabase env value is missing.
import "@/shared/lib/supabase";
import { QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LayoutDirection } from "uniwind";
import { useSession } from "@/features/auth";
import { I18nProvider, useT } from "@/i18n";
import { queryClient } from "@/shared/lib/query-client";
import { ModalCloseButton, useNavigationTheme } from "@/shared/ui";

// A web visitor can open "/sign-in" first. The tabs then sit below the modal,
// so its close button has a screen to go back to.
export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<QueryClientProvider client={queryClient}>
				<I18nProvider>
					<DirectedApp />
				</I18nProvider>
			</QueryClientProvider>
		</GestureHandlerRootView>
	);
}

/**
 * Mirrors the app for Arabic inside the React tree. Expo Go resets the native
 * RTL setting on each project open, so I18nManager alone cannot mirror there.
 * It also applies the navigation theme and guards the sign-in modal with the session.
 */
function DirectedApp() {
	const { t, dir } = useT();
	const isRtl = dir === "rtl";
	const navigationTheme = useNavigationTheme();
	const session = useSession();

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
						<ThemeProvider value={navigationTheme}>
							<Stack>
								<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
								{/* A signed-in user never sees sign-in: when the session arrives, the modal closes.
								    The route stays while the session loads, so a cold open of /sign-in works. */}
								<Stack.Protected guard={session.status !== "signed-in"}>
									<Stack.Screen
										name="sign-in"
										options={{
											presentation: "modal",
											title: t("auth.signInTitle"),
											// The close button is the only way out: no back arrow on Android or the web.
											headerBackVisible: false,
											headerLeft: () => null,
											headerRight: () => (
												<ModalCloseButton label={t("common.close")} />
											),
										}}
									/>
								</Stack.Protected>
							</Stack>
						</ThemeProvider>
					</LocaleProvider>
					<StatusBar style="auto" />
				</HeroUINativeProvider>
			</View>
		</LayoutDirection>
	);
}
