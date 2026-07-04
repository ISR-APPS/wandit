import { Ionicons } from "@expo/vector-icons";
import { Surface, useThemeColor } from "heroui-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Persistent chat bar docked at the bottom of the workspace.
// TODO: wire to the generation API (SSE streaming) + keyboard handling.
export function ChatComposer() {
	const insets = useSafeAreaInsets();
	const [message, setMessage] = useState("");
	const mutedColor = useThemeColor("muted");
	const accentForegroundColor = useThemeColor("accent-foreground");

	function handleSend() {
		const trimmed = message.trim();
		if (!trimmed) {
			return;
		}
		setMessage("");
	}

	return (
		<View className="px-3 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
			<Surface
				variant="secondary"
				className="flex-row items-end gap-2 rounded-2xl p-2"
			>
				<TextInput
					value={message}
					onChangeText={setMessage}
					placeholder="Describe a change…"
					placeholderTextColor={mutedColor}
					multiline
					className="max-h-28 flex-1 px-2 py-2 text-base text-foreground"
				/>
				<Pressable
					onPress={handleSend}
					className="h-9 w-9 items-center justify-center rounded-full bg-accent"
				>
					<Ionicons name="arrow-up" size={18} color={accentForegroundColor} />
				</Pressable>
			</Surface>
		</View>
	);
}
