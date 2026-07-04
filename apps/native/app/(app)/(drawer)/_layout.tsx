import { Drawer } from "expo-router/drawer";
import { useThemeColor } from "heroui-native";

import { ThemeToggle } from "@/components/theme-toggle";
import { ProjectsDrawer } from "@/features/projects";

export default function DrawerLayout() {
	const themeColorForeground = useThemeColor("foreground");
	const themeColorBackground = useThemeColor("background");

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
