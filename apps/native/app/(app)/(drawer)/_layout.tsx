import { useTranslation } from "@wandit/internationalization/react";
import { Drawer, DrawerToggleButton } from "expo-router/drawer";
import { useThemeColor } from "heroui-native";

import { ThemeToggle } from "@/components/theme-toggle";
import { ProjectsDrawer } from "@/features/projects";

export default function DrawerLayout() {
	const themeColorForeground = useThemeColor("foreground");
	const themeColorBackground = useThemeColor("background");
	const { t } = useTranslation();

	return (
		<Drawer
			drawerContent={ProjectsDrawer}
			screenOptions={{
				headerTintColor: themeColorForeground,
				headerStyle: { backgroundColor: themeColorBackground },
				headerTitleStyle: {
					fontWeight: "600",
					color: themeColorForeground,
				},
				headerLeft: () => (
					<DrawerToggleButton
						tintColor={themeColorForeground}
						accessibilityLabel={t("common.sidebarToggle")}
					/>
				),
				drawerStyle: { backgroundColor: themeColorBackground },
			}}
		>
			<Drawer.Screen
				name="index"
				options={{
					headerTitle: "Wandit",
					headerRight: () => <ThemeToggle />,
				}}
			/>
		</Drawer>
	);
}
