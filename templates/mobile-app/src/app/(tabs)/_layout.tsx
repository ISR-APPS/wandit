/**
 * The bottom tab bar: one tab per main section, each with its own stack.
 * The colors come from the navigation theme of the root layout. A tab press
 * gives a light haptic tap on the phone.
 */
import { Tabs } from "expo-router/js-tabs";
import { useThemeColor } from "heroui-native";
import { useT } from "@/i18n";
import { tapFeedback } from "@/shared/lib/haptics";
import { AppIcon } from "@/shared/ui";

export default function TabsLayout() {
	const { t } = useT();
	// The default inactive color (the text at 50 %) is below 4.5:1 contrast on a light page.
	const muted = useThemeColor("muted");
	return (
		<Tabs
			screenListeners={{ tabPress: tapFeedback }}
			screenOptions={{
				// Each tab holds a stack with its own header, so the tab bar shows none.
				headerShown: false,
				animation: "shift",
				tabBarInactiveTintColor: muted,
			}}
		>
			<Tabs.Screen
				name="(home)"
				options={{
					title: t("tabs.home"),
					tabBarIcon: ({ color, focused, size }) => (
						<AppIcon
							color={color}
							name={focused ? "home" : "home-outline"}
							size={size}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="account"
				options={{
					title: t("tabs.account"),
					tabBarIcon: ({ color, focused, size }) => (
						<AppIcon
							color={color}
							name={focused ? "person-circle" : "person-circle-outline"}
							size={size}
						/>
					),
				}}
			/>
		</Tabs>
	);
}
