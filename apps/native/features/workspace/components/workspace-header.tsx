import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MOCK_PROJECTS } from "@/features/projects";

type WorkspaceHeaderProps = {
	projectId: string;
};

export function WorkspaceHeader({ projectId }: WorkspaceHeaderProps) {
	const insets = useSafeAreaInsets();
	const foregroundColor = useThemeColor("foreground");

	// TODO: fetch the project from the API (features/projects/api/).
	const projectName =
		MOCK_PROJECTS.find((project) => project.id === projectId)?.name ??
		projectId;

	function handleBack() {
		if (router.canGoBack()) {
			router.back();
		} else {
			router.replace("/");
		}
	}

	return (
		<View
			className="flex-row items-center gap-1 px-2 pb-1"
			style={{ paddingTop: insets.top + 4 }}
		>
			<Pressable
				onPress={handleBack}
				hitSlop={8}
				className="h-10 w-10 items-center justify-center"
			>
				<Ionicons name="chevron-back" size={22} color={foregroundColor} />
			</Pressable>
			<Text
				numberOfLines={1}
				className="flex-1 font-semibold text-base text-foreground"
			>
				{projectName}
			</Text>
			{/* TODO: publish action + credits balance chip live here. */}
		</View>
	);
}
