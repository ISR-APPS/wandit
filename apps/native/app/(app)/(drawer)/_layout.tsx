import { Drawer } from "expo-router/drawer";
import { useThemeColor } from "heroui-native";
import { useWindowDimensions } from "react-native";

import { ProjectsDrawer } from "@/features/projects";

// Screens draw their own prototype headers; the drawer only provides the
// panel (84% width capped at 330, rounded end corners — light prototype §3).
export default function DrawerLayout() {
	const background = useThemeColor("background");
	const { width } = useWindowDimensions();
	// react-native-drawer-layout only reads `width` for its open/close math,
	// so the 330px cap must be computed here rather than via maxWidth.
	const drawerWidth = Math.min(width * 0.84, 330);

	return (
		<Drawer
			drawerContent={ProjectsDrawer}
			screenOptions={{
				headerShown: false,
				drawerType: "front",
				drawerStyle: {
					backgroundColor: background,
					width: drawerWidth,
					borderTopEndRadius: 26,
					borderBottomEndRadius: 26,
					boxShadow: "24px 0 60px -30px rgba(26, 21, 18, 0.5)",
				},
			}}
		>
			<Drawer.Screen name="index" />
			<Drawer.Screen name="project/[projectId]" />
		</Drawer>
	);
}
