import { useDictionary } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";
import { AppBottomSheet } from "@/shared/ui/bottom-sheet";

import { ROUTE_MODES, type RouteMode } from "../lib/prompt";

type EnginePickerSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	mode: RouteMode;
	onSelect: (mode: RouteMode) => void;
};

/** Bottom-sheet picker for the composer route mode (web ModePicker twin). */
export function EnginePickerSheet({
	isOpen,
	onOpenChange,
	mode,
	onSelect,
}: EnginePickerSheetProps) {
	const promptBox = useDictionary().projects.promptBox;
	const foreground = useThemeColor("foreground");
	const accent = useThemeColor("accent");

	return (
		<AppBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
			<AppBottomSheet.Portal>
				<AppBottomSheet.Overlay />
				<AppBottomSheet.Content
					backgroundClassName="bg-background rounded-t-[26px]"
					handleIndicatorClassName="w-[42px] bg-foreground/15"
					contentContainerClassName="px-4 pb-12"
				>
					<Text className="mb-2 px-1 font-mono text-[10px] text-muted uppercase tracking-[1.4px]">
						{promptBox.modeLabel}
					</Text>
					{ROUTE_MODES.map((routeMode) => {
						const selected = routeMode.id === mode;
						return (
							<Pressable
								key={routeMode.id}
								accessibilityRole="button"
								onPress={() => {
									onSelect(routeMode.id);
									onOpenChange(false);
								}}
								className="flex-row items-center gap-3 rounded-[14px] px-2 py-3 active:bg-surface-secondary"
							>
								<View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-border bg-surface">
									<WanditIcon
										name={routeMode.icon}
										size={16}
										color={selected ? accent : foreground}
									/>
								</View>
								<View className="flex-1">
									<Text className="font-sans-semibold text-[15px] text-foreground">
										{promptBox.routeModes[routeMode.id].label}
									</Text>
									<Text className="mt-0.5 text-[12.5px] text-muted">
										{promptBox.routeModes[routeMode.id].description}
									</Text>
								</View>
								{selected ? (
									<WanditIcon name="check" size={16} color={accent} />
								) : null}
							</Pressable>
						);
					})}
				</AppBottomSheet.Content>
			</AppBottomSheet.Portal>
		</AppBottomSheet>
	);
}
