import type { Project } from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { Dialog, useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";

import { useDeleteProject } from "../api/projects.mutations";

/**
 * Delete confirmation from the drawer prototype: Keep / Delete. The removal
 * is optimistic (the mutation rolls the caches back on failure), so the
 * dialog closes on tap and the drawer toasts the outcome.
 */

type DeleteProjectDialogProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	project: Project | null;
	onDeleted: (project: Project) => void;
	onError: () => void;
};

export function DeleteProjectDialog({
	isOpen,
	onOpenChange,
	project,
	onDeleted,
	onError,
}: DeleteProjectDialogProps) {
	const { t } = useTranslation();
	const danger = useThemeColor("danger");
	const deleteProject = useDeleteProject();

	function confirmDelete() {
		if (!project) {
			return;
		}
		// The row disappears instantly via the mutation's optimistic cache
		// removal; the "Deleted" toast and any route replacement wait for the
		// server so a failed delete never navigates away or claims success.
		deleteProject.mutate(project.id, {
			onSuccess: () => onDeleted(project),
			onError,
		});
		onOpenChange(false);
	}

	return (
		<Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="bg-black/50" />
				<Dialog.Content className="p-5">
					<Dialog.Title className="font-sans-semibold text-[16px]">
						{t("native.drawer.deleteTitle")}
					</Dialog.Title>
					<Dialog.Description className="mt-2 font-sans-medium text-[14px] text-muted leading-5">
						{t("native.drawer.deleteBody", { name: project?.name ?? "" })}
					</Dialog.Description>
					<View className="mt-[18px] flex-row gap-2.5">
						<Pressable
							accessibilityRole="button"
							onPress={() => onOpenChange(false)}
							className="h-[46px] flex-1 items-center justify-center rounded-full border border-border active:opacity-80"
						>
							<Text className="font-sans-semibold text-[14.5px] text-foreground">
								{t("native.drawer.deleteKeep")}
							</Text>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							onPress={confirmDelete}
							className="h-[46px] flex-1 items-center justify-center rounded-full active:opacity-90"
							style={{ backgroundColor: danger }}
						>
							<Text
								className="font-sans-semibold text-[14.5px]"
								style={{ color: "#FCFBF8" }}
							>
								{t("native.drawer.delete")}
							</Text>
						</Pressable>
					</View>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog>
	);
}
