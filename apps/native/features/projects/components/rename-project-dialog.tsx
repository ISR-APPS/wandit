import type { Project } from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { Dialog, useThemeColor } from "heroui-native";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	Text,
	TextInput,
	View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { useRenameProject } from "../api/projects.mutations";

/**
 * Centered rename dialog from the drawer prototype: prefilled name field,
 * Cancel / Save. Owns the rename mutation; the drawer only hears the
 * outcome for its toast.
 */

type RenameProjectDialogProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	project: Project | null;
	onRenamed: (name: string) => void;
	onError: () => void;
};

export function RenameProjectDialog({
	isOpen,
	onOpenChange,
	project,
	onRenamed,
	onError,
}: RenameProjectDialogProps) {
	const { dir, t } = useTranslation();
	const accent = useThemeColor("accent");
	const accentForeground = useThemeColor("accent-foreground");
	const muted = useThemeColor("muted");
	const renameProject = useRenameProject();
	const [name, setName] = useState("");

	// Reseed the field each time the dialog opens for a project, and detach
	// the observer from any still-pending previous rename — otherwise its
	// isPending leaks into this open and its per-mutate callbacks could close
	// this dialog when the old request settles. The cache patch still runs:
	// it lives on the mutation itself, not the observer.
	useEffect(() => {
		if (isOpen) {
			setName(project?.name ?? "");
			renameProject.reset();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- reset is stable
	}, [isOpen, project?.name]);

	const trimmed = name.trim();
	const canSave =
		!!project && trimmed.length > 0 && !renameProject.isPending;

	function save() {
		if (!project || !canSave) {
			return;
		}
		if (trimmed === project.name) {
			onOpenChange(false);
			return;
		}
		renameProject.mutate(
			{ projectId: project.id, name: trimmed },
			{
				onSuccess: () => {
					onOpenChange(false);
					onRenamed(trimmed);
				},
				onError: () => {
					onOpenChange(false);
					onError();
				},
			},
		);
	}

	return (
		<Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="bg-black/50" />
				<KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={24}>
					<Dialog.Content className="p-5">
						<Dialog.Title className="font-sans-semibold text-[16px]">
							{t("native.drawer.renameTitle")}
						</Dialog.Title>
						<TextInput
							value={name}
							onChangeText={setName}
							autoFocus
							autoCorrect={false}
							maxLength={120}
							returnKeyType="done"
							onSubmitEditing={save}
							selectionColor={accent}
							placeholderTextColor={muted}
							accessibilityLabel={t("native.drawer.renameTitle")}
							className="mt-3.5 h-[46px] rounded-[12px] border-[1.5px] border-accent/50 bg-surface-secondary/80 px-3.5 font-sans-medium text-[15px] text-foreground"
							style={{ textAlign: dir === "rtl" ? "right" : "left" }}
						/>
						<View className="mt-4 flex-row gap-2.5">
							<Pressable
								accessibilityRole="button"
								onPress={() => onOpenChange(false)}
								className="h-[46px] flex-1 items-center justify-center rounded-full border border-border active:opacity-80"
							>
								<Text className="font-sans-semibold text-[14.5px] text-foreground">
									{t("native.drawer.cancel")}
								</Text>
							</Pressable>
							<Pressable
								accessibilityRole="button"
								accessibilityState={{ disabled: !canSave }}
								disabled={!canSave}
								onPress={save}
								className="h-[46px] flex-1 items-center justify-center rounded-full bg-accent active:opacity-90 disabled:opacity-50"
							>
								{renameProject.isPending ? (
									<ActivityIndicator size="small" color={accentForeground} />
								) : (
									<Text
										className="font-sans-semibold text-[14.5px]"
										style={{ color: accentForeground }}
									>
										{t("native.drawer.renameSave")}
									</Text>
								)}
							</Pressable>
						</View>
					</Dialog.Content>
				</KeyboardAvoidingView>
			</Dialog.Portal>
		</Dialog>
	);
}
