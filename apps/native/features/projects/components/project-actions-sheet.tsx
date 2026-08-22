import type { Project } from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";

import type { WanditIconName } from "@/components/wandit-icon";
import { WanditIcon } from "@/components/wandit-icon";
import { AppBottomSheet } from "@/shared/ui/bottom-sheet";

import { ProjectThumb } from "./drawer-project-row";

/**
 * Press-and-hold sheet from the drawer prototype: the project lifts onto a
 * card and the actions rise under it — rename, open the live page (when one
 * exists), delete. No ⋯ target competes with the row tap.
 */

type ProjectActionsSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	/** The pressed project; kept while closing so the card doesn't blank. */
	project: Project | null;
	/** Sub-line under the name on the lifted card. */
	projectMeta: string;
	/** Opens the rename dialog (the sheet closes itself first). */
	onRename: () => void;
	/** Opens the live page in the in-app browser. */
	onOpenLive: () => void;
	/** Opens the delete confirmation (the sheet closes itself first). */
	onDelete: () => void;
};

export function ProjectActionsSheet({
	isOpen,
	onOpenChange,
	project,
	projectMeta,
	onRename,
	onOpenLive,
	onDelete,
}: ProjectActionsSheetProps) {
	const { t } = useTranslation();
	const foreground = useThemeColor("foreground");
	const danger = useThemeColor("danger");
	const isLive = project?.status === "published" && !!project.publishedSlug;

	// Close, then hand off immediately — the drawer owns the 220ms delay
	// before opening the next surface, so it can cancel the handoff when
	// the drawer itself closes.
	const closeThen = (action: () => void) => () => {
		onOpenChange(false);
		action();
	};

	return (
		<AppBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
			<AppBottomSheet.Portal>
				<AppBottomSheet.Overlay className="bg-black/45" />
				<AppBottomSheet.Content
					detached
					bottomInset={14}
					handleComponent={null}
					style={{ marginHorizontal: 10 }}
					backgroundClassName="bg-transparent"
					contentContainerClassName="px-0 pb-0"
				>
					{project ? (
						<View className="mb-2.5 flex-row items-center gap-3 rounded-[16px] border border-border bg-surface p-3 dark:bg-surface-secondary/95">
							<ProjectThumb project={project} />
							<View className="min-w-0 flex-1">
								<Text
									numberOfLines={1}
									className="font-sans-semibold text-[14.5px] text-foreground"
								>
									{project.name}
								</Text>
								{projectMeta ? (
									<Text
										numberOfLines={1}
										className="mt-1 font-sans-medium text-[12px] text-muted"
									>
										{projectMeta}
									</Text>
								) : null}
							</View>
						</View>
					) : null}
					<View className="overflow-hidden rounded-[18px] border border-border bg-surface dark:bg-surface-secondary/95">
						<ActionRow
							icon="pencil"
							color={foreground}
							label={t("native.drawer.rename")}
							onPress={closeThen(onRename)}
						/>
						{isLive ? (
							<>
								<RowSeparator />
								<ActionRow
									icon="externalLink"
									color={foreground}
									label={t("native.drawer.openLive")}
									onPress={closeThen(onOpenLive)}
								/>
							</>
						) : null}
						<RowSeparator />
						<ActionRow
							icon="trash"
							color={danger}
							label={t("native.drawer.delete")}
							onPress={closeThen(onDelete)}
						/>
					</View>
					<Pressable
						accessibilityRole="button"
						onPress={() => onOpenChange(false)}
						className="mt-2 h-[52px] items-center justify-center rounded-[16px] bg-surface active:opacity-80 dark:bg-surface-tertiary"
					>
						<Text className="font-sans-bold text-[15.5px] text-foreground">
							{t("native.drawer.cancel")}
						</Text>
					</Pressable>
				</AppBottomSheet.Content>
			</AppBottomSheet.Portal>
		</AppBottomSheet>
	);
}

function ActionRow({
	icon,
	color,
	label,
	onPress,
}: {
	icon: WanditIconName;
	color: string;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			className="flex-row items-center justify-between gap-3 px-4 py-[15px] active:bg-surface-secondary"
		>
			<Text
				className="flex-1 font-sans-medium text-[15px]"
				style={{ color }}
			>
				{label}
			</Text>
			<WanditIcon name={icon} size={18} color={color} />
		</Pressable>
	);
}

function RowSeparator() {
	return <View className="h-px bg-separator" />;
}
