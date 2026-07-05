import "@/global.css";
import {
	BricolageGrotesque_600SemiBold,
	BricolageGrotesque_700Bold,
	BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
	GeistMono_400Regular,
	GeistMono_500Medium,
	GeistMono_600SemiBold,
} from "@expo-google-fonts/geist-mono";
import {
	InstrumentSans_400Regular,
	InstrumentSans_500Medium,
	InstrumentSans_600SemiBold,
	InstrumentSans_700Bold,
} from "@expo-google-fonts/instrument-sans";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { HeroUINativeProvider } from "heroui-native";
import { I18nManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { LocaleProvider } from "@/contexts/locale-context";
import { authClient } from "@/lib/auth-client";
import { useAuthBypass } from "@/lib/dev-auth-bypass";

// See docs/localization.md before using forceRTL; it requires an app restart.
I18nManager.allowRTL(true);

export const unstable_settings = {
	initialRouteName: "(app)",
};

function RootNavigator() {
	const { data: session, isPending } = authClient.useSession();
	// DEV: the Welcome Google button flips this instead of running OAuth —
	// see lib/dev-auth-bypass.ts. Remove alongside that file.
	const authBypassed = useAuthBypass();
	const signedIn = !!session?.user || authBypassed;
	// Font families referenced by global.css (--font-*); keep both lists in sync.
	const [fontsLoaded, fontsError] = useFonts({
		BricolageGrotesque_600SemiBold,
		BricolageGrotesque_700Bold,
		BricolageGrotesque_800ExtraBold,
		GeistMono_400Regular,
		GeistMono_500Medium,
		GeistMono_600SemiBold,
		InstrumentSans_400Regular,
		InstrumentSans_500Medium,
		InstrumentSans_600SemiBold,
		InstrumentSans_700Bold,
	});

	// TODO: keep the splash screen visible while the session is restoring.
	if (isPending || (!fontsLoaded && !fontsError)) {
		return null;
	}

	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Protected guard={signedIn}>
				<Stack.Screen name="(app)" />
			</Stack.Protected>
			<Stack.Protected guard={!signedIn}>
				<Stack.Screen name="(auth)" />
			</Stack.Protected>
		</Stack>
	);
}

export default function Layout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<KeyboardProvider>
				<AppThemeProvider>
					<LocaleProvider>
						<HeroUINativeProvider>
							<RootNavigator />
						</HeroUINativeProvider>
					</LocaleProvider>
				</AppThemeProvider>
			</KeyboardProvider>
		</GestureHandlerRootView>
	);
}
