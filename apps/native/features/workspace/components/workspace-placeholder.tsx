import { Text, View } from "react-native";

type WorkspacePlaceholderProps = {
	title: string;
	description: string;
};

// Temporary stand-in while the tab screens get built out.
export function WorkspacePlaceholder({
	title,
	description,
}: WorkspacePlaceholderProps) {
	return (
		<View className="flex-1 items-center justify-center gap-2 px-8">
			<Text className="font-semibold text-foreground text-lg">{title}</Text>
			<Text className="text-center text-muted text-sm">{description}</Text>
		</View>
	);
}
