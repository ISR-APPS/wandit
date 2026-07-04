import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native";
import { Pressable, Text } from "react-native";

import type { ProjectSummary } from "../lib/constants";

type ProjectListItemProps = {
	project: ProjectSummary;
	onPress: () => void;
};

export function ProjectListItem({ project, onPress }: ProjectListItemProps) {
	const mutedColor = useThemeColor("muted");

	return (
		<Pressable
			onPress={onPress}
			className="flex-row items-center gap-3 rounded-lg px-3 py-3 active:bg-surface-secondary"
		>
			<Ionicons name="document-text-outline" size={18} color={mutedColor} />
			<Text numberOfLines={1} className="flex-1 text-foreground text-sm">
				{project.name}
			</Text>
		</Pressable>
	);
}
