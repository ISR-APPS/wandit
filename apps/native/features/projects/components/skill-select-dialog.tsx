import { useDictionary } from "@wandit/internationalization/react";
import {
	Checkbox,
	ControlField,
	cn,
	Dialog,
	useThemeColor,
} from "heroui-native";
import { Fragment, useEffect, useState } from "react";
import { Text, TextInput, useWindowDimensions, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WanditIcon } from "@/components/wandit-icon";

import {
	ALL_SKILLS,
	SKILL_GROUPS,
	type SkillFileDef,
	type SkillFileId,
} from "../lib/prompt";

type SkillSelectDialogProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	selectedSkillIds: readonly SkillFileId[];
	onToggleSkill: (skill: SkillFileDef) => void;
};

/**
 * Multi-select skill picker as a searchable dialog (HeroUI
 * searchable-dialog-select pattern): title + search field + scrollable
 * checkbox rows, opened from the [+] attach sheet. Grouped while the query
 * is empty; a flat filtered list once the user types — the library will
 * grow well past the current handful of skills.
 */
export function SkillSelectDialog({
	isOpen,
	onOpenChange,
	selectedSkillIds,
	onToggleSkill,
}: SkillSelectDialogProps) {
	const promptBox = useDictionary().projects.promptBox;
	const foreground = useThemeColor("foreground");
	const accent = useThemeColor("accent");
	const muted = useThemeColor("muted");
	const { height } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const [query, setQuery] = useState("re");

	// Fresh search every time the dialog reopens.
	useEffect(() => {
		if (!isOpen) {
			setQuery("");
		}
	}, [isOpen]);

	const insetTop = insets.top + 12;
	// Fixed height (reference layout) so the list doesn't jump as the
	// keyboard shows or the filter shrinks the results.
	const dialogHeight = (height - insetTop) / 2;

	const trimmedQuery = query.trim().toLowerCase();
	const filteredSkills = ALL_SKILLS.filter((skill) => {
		if (!trimmedQuery) {
			return true;
		}
		return (
			promptBox.skills[skill.id].label.toLowerCase().includes(trimmedQuery) ||
			skill.fileName.toLowerCase().includes(trimmedQuery)
		);
	});

	const renderSkillRow = (skill: SkillFileDef) => {
		const selected = selectedSkillIds.includes(skill.id);
		return (
			<ControlField
				key={skill.id}
				isSelected={selected}
				onSelectedChange={() => onToggleSkill(skill)}
				className="rounded-[14px] px-2 py-2.5"
			>
				<View
					className={cn(
						"h-7 w-7 items-center justify-center rounded-lg border",
						selected
							? "border-accent/30 bg-accent/10"
							: "border-border bg-surface-secondary",
					)}
				>
					<WanditIcon
						name={skill.icon}
						size={13}
						color={selected ? accent : foreground}
					/>
				</View>
				<View className="flex-1">
					<View className="flex-row items-baseline gap-2">
						<Text className="font-sans-semibold text-[14.5px] text-foreground">
							{promptBox.skills[skill.id].label}
						</Text>
						<Text className="font-mono text-[10px] text-muted">
							{skill.fileName}
						</Text>
					</View>
					<Text className="mt-0.5 text-[12px] text-muted">
						{promptBox.skills[skill.id].description}
					</Text>
				</View>
				<ControlField.Indicator>
					<Checkbox isSelected={selected} />
				</ControlField.Indicator>
			</ControlField>
		);
	};

	return (
		<Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="bg-black/45" />
				<KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={24}>
					<Dialog.Content
						className="p-4"
						style={{ marginTop: insetTop, height: dialogHeight }}
					>
						<View className="mb-2.5 flex-row items-center justify-between ps-2">
							<Dialog.Title className="font-sans-semibold text-[16.5px]">
								{promptBox.addSkillLabel}
							</Dialog.Title>
							<Dialog.Close variant="ghost" />
						</View>
						<TextInput
							value={query}
							onChangeText={setQuery}
							placeholder={promptBox.searchSkillsPlaceholder}
							placeholderTextColor={muted}
							autoFocus
							autoCorrect={false}
							accessibilityLabel={promptBox.searchSkillsPlaceholder}
							className="mb-2 rounded-xl bg-surface-secondary/80 p-3 text-[15px] text-foreground"
						/>
						{filteredSkills.length === 0 ? (
							<View className="flex-1 items-center justify-center">
								<Text className="font-sans-medium text-[14px] text-muted">
									{promptBox.noSkillResults}
								</Text>
							</View>
						) : (
							<ScrollView
								showsVerticalScrollIndicator={false}
								bounces={false}
								keyboardShouldPersistTaps="handled"
							>
								{trimmedQuery ? (
									filteredSkills.map(renderSkillRow)
								) : (
									<>
										{SKILL_GROUPS.map((group, groupIndex) => (
											<Fragment key={group.id}>
												{groupIndex > 0 ? (
													<View className="my-2 h-px bg-separator" />
												) : null}
												<Text className="mt-1 mb-1 px-2 font-mono text-[9.5px] text-muted uppercase tracking-[1.2px]">
													{promptBox.skillGroups[group.id].label}
												</Text>
												{group.skills.map(renderSkillRow)}
											</Fragment>
										))}
									</>
								)}
							</ScrollView>
						)}
					</Dialog.Content>
				</KeyboardAvoidingView>
			</Dialog.Portal>
		</Dialog>
	);
}
