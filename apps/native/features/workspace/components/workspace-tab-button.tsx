import type { TabTriggerSlotProps } from "expo-router/ui";
import { cn } from "heroui-native";
import { Pressable, Text } from "react-native";

type WorkspaceTabButtonProps = TabTriggerSlotProps & {
	label: string;
};

export function WorkspaceTabButton({
	label,
	isFocused,
	...props
}: WorkspaceTabButtonProps) {
	return (
		<Pressable
			{...props}
			className={cn(
				"rounded-full px-4 py-1.5",
				isFocused ? "bg-accent" : "bg-surface-secondary",
			)}
		>
			<Text
				className={cn(
					"font-medium text-sm",
					isFocused ? "text-accent-foreground" : "text-muted",
				)}
			>
				{label}
			</Text>
		</Pressable>
	);
}
