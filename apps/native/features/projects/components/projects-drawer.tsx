import { router } from "expo-router";
import { Button } from "heroui-native";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { authClient } from "@/lib/auth-client";

import { MOCK_PROJECTS } from "../lib/constants";
import { ProjectListItem } from "./project-list-item";

// Minimal structural type: @react-navigation/drawer is not a direct
// dependency (pnpm isolated node-linker), so type only what is used.
type ProjectsDrawerProps = {
	navigation: {
		closeDrawer: () => void;
	};
};

export function ProjectsDrawer({ navigation }: ProjectsDrawerProps) {
	const insets = useSafeAreaInsets();
	const { data: session } = authClient.useSession();

	function openProject(projectId: string) {
		navigation.closeDrawer();
		router.push(`/project/${projectId}`);
	}

	return (
		<View
			className="flex-1"
			style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}
		>
			<View className="px-4 pb-3">
				<Text className="font-semibold text-foreground text-lg">Projects</Text>
			</View>

			{/* TODO: fetch the real project list (features/projects/api/). */}
			<FlatList
				data={MOCK_PROJECTS}
				keyExtractor={(project) => project.id}
				contentContainerStyle={{ paddingHorizontal: 8 }}
				renderItem={({ item }) => (
					<ProjectListItem
						project={item}
						onPress={() => openProject(item.id)}
					/>
				)}
			/>

			<View className="gap-3 border-border border-t px-4 pt-3">
				<Text numberOfLines={1} className="text-muted text-sm">
					{session?.user?.email}
				</Text>
				<Button
					variant="secondary"
					size="sm"
					onPress={() => authClient.signOut()}
				>
					<Button.Label>Sign out</Button.Label>
				</Button>
			</View>
		</View>
	);
}
