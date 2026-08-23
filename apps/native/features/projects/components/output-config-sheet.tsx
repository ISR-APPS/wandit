import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import { cn, useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { AppBottomSheet } from "@/shared/ui/bottom-sheet";

import {
	type ConcreteMode,
	type GenerationOutputDef,
	OUTPUTS_BY_MODE,
} from "../lib/prompt";

// Localized option copy is keyed by ids the dictionary type can't index
// generically (same cast as the web OutputSettings).
type OptionCopy = { label: string; choices: Record<string, string> };

type OutputConfigSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	mode: ConcreteMode;
	output: GenerationOutputDef;
	values: Record<string, string>;
	onSelectOutput: (output: GenerationOutputDef) => void;
	onValueChange: (groupId: string, choiceId: string) => void;
};

/**
 * Output + options configurator behind the composer's sliders button: pick
 * what to generate for the current mode (product shot, ad creative…), then
 * tune its option groups (quality, size, count…) as chip rows.
 */
export function OutputConfigSheet({
	isOpen,
	onOpenChange,
	mode,
	output,
	values,
	onSelectOutput,
	onValueChange,
}: OutputConfigSheetProps) {
	const { t } = useTranslation();
	const promptBox = useDictionary().projects.promptBox;
	const { isDark } = useAppTheme();
	const accent = useThemeColor("accent");
	const muted = useThemeColor("muted");
	// Deep ember for selected chip text on light (home suggestion chips tone).
	const chipActiveColor = isDark ? accent : "#8D3700";

	const outputs = OUTPUTS_BY_MODE[mode];
	const outputCopy = promptBox.outputs[output.id];
	const optionsCopy = outputCopy.options as unknown as Record<
		string,
		OptionCopy
	>;

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
						{t("projects.promptBox.outputsHeading", {
							mode: promptBox.routeModes[mode].label,
						})}
					</Text>
					<View className="flex-row flex-wrap gap-[7px] px-1">
						{outputs.map((item) => {
							const selected = item.id === output.id;
							return (
								<Pressable
									key={item.id}
									accessibilityRole="button"
									accessibilityState={{ selected }}
									onPress={() => onSelectOutput(item)}
									className={cn(
										"h-[34px] flex-row items-center gap-1.5 rounded-full border px-3",
										selected
											? "border-accent/45 bg-accent/10"
											: "border-border bg-surface dark:bg-surface-tertiary/55",
									)}
								>
									<WanditIcon
										name={item.icon}
										size={12}
										color={selected ? accent : muted}
									/>
									<Text
										className={cn(
											"font-sans-semibold text-[12.5px]",
											!selected && "text-muted",
										)}
										style={selected ? { color: chipActiveColor } : undefined}
									>
										{promptBox.outputs[item.id].shortLabel}
									</Text>
								</Pressable>
							);
						})}
					</View>
					<Text className="mt-2.5 px-1 text-[12px] text-muted">
						{outputCopy.description}
					</Text>
					<View className="my-3 h-px bg-separator" />
					<View className="mb-3.5">
						{mode === "video" ? (
							// Video has no tiers — a static row replaces the heading +
							// selectable tiles (web parity). No price is shown before
							// the call; the balance moves once, after settle.
							<View className="mx-1 min-h-9 flex-row items-center rounded-[12px] border border-accent/45 bg-accent/10 px-3 py-2">
								<Text className="text-[12px] text-muted">
									{promptBox.qualityLabel}
								</Text>
							</View>
						) : (
							<>
								<Text className="mb-1.5 px-1 font-mono text-[9.5px] text-muted uppercase tracking-[1.2px]">
									{promptBox.qualityLabel}
								</Text>
								<View className="flex-row flex-wrap gap-[7px] px-1">
									{(["standard", "max"] as const).map((quality) => {
										const selected = values.quality === quality;
										return (
											<Pressable
												key={quality}
												accessibilityRole="button"
												accessibilityState={{ selected }}
												onPress={() => onValueChange("quality", quality)}
												className={cn(
													"rounded-[12px] border px-3 py-2",
													selected
														? "border-accent/45 bg-accent/10"
														: "border-border bg-surface dark:bg-surface-tertiary/55",
												)}
											>
												<Text
													className={cn(
														"font-sans-semibold text-[12px]",
														!selected && "text-muted",
													)}
													style={
														selected ? { color: chipActiveColor } : undefined
													}
												>
													{promptBox.quality[quality].label}
												</Text>
												<Text className="mt-0.5 text-[10.5px] text-muted">
													{promptBox.quality[quality].hint}
												</Text>
											</Pressable>
										);
									})}
								</View>
							</>
						)}
					</View>
					{output.options.map((group) => {
						const groupCopy = optionsCopy[group.id];
						return (
							<View key={group.id} className="mb-3.5">
								<Text className="mb-1.5 px-1 font-mono text-[9.5px] text-muted uppercase tracking-[1.2px]">
									{groupCopy.label}
								</Text>
								<View className="flex-row flex-wrap gap-[7px] px-1">
									{group.choices.map((choice) => {
										const selected = values[group.id] === choice.id;
										return (
											<Pressable
												key={choice.id}
												accessibilityRole="button"
												accessibilityState={{ selected }}
												onPress={() => onValueChange(group.id, choice.id)}
												className={cn(
													"h-[32px] items-center justify-center rounded-full border px-3",
													selected
														? "border-accent/45 bg-accent/10"
														: "border-border bg-surface dark:bg-surface-tertiary/55",
												)}
											>
												<Text
													className={cn(
														"font-sans-semibold text-[12px]",
														!selected && "text-muted",
													)}
													style={
														selected ? { color: chipActiveColor } : undefined
													}
												>
													{groupCopy.choices[choice.id]}
												</Text>
											</Pressable>
										);
									})}
								</View>
							</View>
						);
					})}
				</AppBottomSheet.Content>
			</AppBottomSheet.Portal>
		</AppBottomSheet>
	);
}
