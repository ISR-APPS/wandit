import { useId } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import type { ProjectSummary } from "../lib/constants";

type ProjectListItemProps = {
	project: ProjectSummary;
	onPress: () => void;
};

/** Drawer project row: 50px gradient letter tile + name + meta (light §3.3). */
export function ProjectListItem({ project, onPress }: ProjectListItemProps) {
	const gradientId = `tile${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const [from, to] = project.tile;

	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			className="flex-row items-center gap-3 py-[9px] active:scale-[0.98]"
		>
			<View className="h-[50px] w-[50px] items-center justify-center overflow-hidden rounded-[14px]">
				<Svg style={StyleSheet.absoluteFill} pointerEvents="none">
					<Defs>
						{/* 160deg ramp approximated top-left -> bottom-right */}
						<LinearGradient id={gradientId} x1="0" y1="0" x2="0.35" y2="1">
							<Stop offset="0" stopColor={from} />
							<Stop offset="1" stopColor={to} />
						</LinearGradient>
					</Defs>
					<Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
				</Svg>
				<Text className="font-mono-semibold text-[#623E29] text-[14px]">
					{project.name.charAt(0)}
				</Text>
			</View>
			<View className="flex-1">
				<Text
					numberOfLines={1}
					className="font-sans-semibold text-[15px] text-foreground"
				>
					{project.name}
				</Text>
				<Text className="mt-0.5 text-[12.5px] text-muted">
					{project.updatedAt}
				</Text>
			</View>
		</Pressable>
	);
}
