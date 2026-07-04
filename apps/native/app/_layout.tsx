import "@/global.css";
import { Stack } from "expo-router";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { authClient } from "@/lib/auth-client";

export const unstable_settings = {
	initialRouteName: "(app)",
};

function RootNavigator() {
	const { data: session, isPending } = authClient.useSession();

	// TODO: keep the splash screen visible while the session is restoring.
	if (isPending) {
		return null;
	}

	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Protected guard={!!session?.user}>
				<Stack.Screen name="(app)" />
			</Stack.Protected>
			<Stack.Protected guard={!session?.user}>
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
					<HeroUINativeProvider>
						<RootNavigator />
					</HeroUINativeProvider>
				</AppThemeProvider>
			</KeyboardProvider>
		</GestureHandlerRootView>
	);
}
