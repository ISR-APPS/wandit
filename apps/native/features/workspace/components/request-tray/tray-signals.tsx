// Companion signal for the request tray: the in-thread pointer chip that
// directs the user from the asking message down to the composer ("Pick
// below ↓"). Mobile twin of the web tray-signals.tsx — the header status pill
// stays web-only for now (the mobile chat header has no room for it).
// Layout metrics use explicit style numbers, same rule as the tray shell.

import { useThemeColor } from "heroui-native";
import { Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";

export type TrayPointerIcon = "question" | "options";

export function TrayPointerChip({
	icon = "question",
	label,
}: {
	icon?: TrayPointerIcon;
	label: string;
}) {
	const accent = useThemeColor("accent");

	return (
		<View className="flex-row" style={{ marginTop: 2 }}>
			<View
				className="flex-row items-center rounded-full border border-border bg-surface"
				style={{ height: 28, paddingHorizontal: 11, gap: 7 }}
			>
				{icon === "options" ? (
					<WanditIcon name="sliders" size={12} color={accent} />
				) : (
					<View
						className="items-center justify-center rounded-[5px] border border-accent/40 bg-accent/10"
						style={{ width: 14, height: 14 }}
					>
						<Text
							className="font-sans-semibold"
							style={{ fontSize: 9, lineHeight: 11, color: accent }}
						>
							?
						</Text>
					</View>
				)}
				<Text className="font-mono text-muted" style={{ fontSize: 11 }}>
					{label}
				</Text>
			</View>
		</View>
	);
}
