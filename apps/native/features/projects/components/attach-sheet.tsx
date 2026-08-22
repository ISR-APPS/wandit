import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";
import type { WanditIconName } from "@/components/wandit-icon";
import { WanditIcon } from "@/components/wandit-icon";
import { AppBottomSheet } from "@/shared/ui/bottom-sheet";

type AttachSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	/** Opens the skill select dialog (the sheet closes itself first). */
	onAttachSkill: () => void;
	/** Attached-skill count shown on the skill row. */
	skillCount: number;
	/** Camera capture → upload (the sheet closes itself first). */
	onTakePhoto: () => void;
	/** Photo library picker → upload (the sheet closes itself first). */
	onPickFromLibrary: () => void;
	/** Document picker → upload (the sheet closes itself first). */
	onBrowseFiles: () => void;
	/** Opens the MCP connectors sheet (the sheet closes itself first). */
	onConnectApps: () => void;
};

/**
 * The [+] sheet: media/file pickers feed the composer's attachment chips,
 * skills open the skill dialog, and Connect apps opens the MCP connectors
 * sheet — the native twin of the web AddContextMenu.
 */
export function AttachSheet({
	isOpen,
	onOpenChange,
	onAttachSkill,
	skillCount,
	onTakePhoto,
	onPickFromLibrary,
	onBrowseFiles,
	onConnectApps,
}: AttachSheetProps) {
	const { t } = useTranslation();
	const accent = useThemeColor("accent");
	const foreground = useThemeColor("foreground");

	// Close first so the picker/dialog animation does not fight the sheet's
	// dismissal (same 220ms handoff the skill dialog already uses).
	const closeThen = (action: () => void) => () => {
		onOpenChange(false);
		setTimeout(action, 220);
	};

	return (
		<AppBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
			<AppBottomSheet.Portal>
				<AppBottomSheet.Overlay className="bg-black/45" />
				{/* Inset iOS-style action sheet: floating cards over the dimmer,
				    no grabber. */}
				<AppBottomSheet.Content
					detached
					bottomInset={14}
					handleComponent={null}
					style={{ marginHorizontal: 10 }}
					backgroundClassName="bg-transparent"
					contentContainerClassName="px-0 pb-0"
				>
					<View className="overflow-hidden rounded-[18px] border border-border bg-surface dark:bg-surface-secondary/95">
						<SheetRow
							icon="camera"
							iconColor={foreground}
							label={t("native.attach.takePhoto")}
							onPress={closeThen(onTakePhoto)}
						/>
						<RowSeparator />
						<SheetRow
							icon="image"
							iconColor={foreground}
							label={t("native.attach.photoLibrary")}
							onPress={closeThen(onPickFromLibrary)}
						/>
						<RowSeparator />
						<SheetRow
							icon="page"
							iconColor={foreground}
							label={t("native.attach.browseFiles")}
							onPress={closeThen(onBrowseFiles)}
						/>
						<RowSeparator />
						<SheetRow
							icon="spark"
							iconColor={accent}
							label={t("native.attach.attachSkill")}
							onPress={() => {
								onOpenChange(false);
								onAttachSkill();
							}}
							badgeCount={skillCount}
						/>
						<RowSeparator />
						<SheetRow
							icon="plug"
							iconColor={accent}
							label={t("native.attach.connectApps")}
							onPress={closeThen(onConnectApps)}
						/>
					</View>
					<Pressable
						accessibilityRole="button"
						onPress={() => onOpenChange(false)}
						className="mt-2 h-[52px] items-center justify-center rounded-[16px] bg-surface active:opacity-80 dark:bg-surface-tertiary"
					>
						<Text className="font-sans-bold text-[15.5px] text-foreground">
							{t("native.attach.cancel")}
						</Text>
					</Pressable>
				</AppBottomSheet.Content>
			</AppBottomSheet.Portal>
		</AppBottomSheet>
	);
}

function SheetRow({
	icon,
	iconColor,
	label,
	onPress,
	badgeCount = 0,
}: {
	icon: WanditIconName;
	iconColor: string;
	label: string;
	onPress: () => void;
	badgeCount?: number;
}) {
	const accent = useThemeColor("accent");

	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			className="flex-row items-center gap-3 px-4 py-[15px] active:bg-surface-secondary"
		>
			<WanditIcon name={icon} size={18} color={iconColor} />
			<Text className="flex-1 font-sans-medium text-[15px] text-foreground">
				{label}
			</Text>
			{badgeCount > 0 ? (
				<View className="h-[22px] min-w-[22px] items-center justify-center rounded-full bg-accent/10 px-1.5">
					<Text
						className="font-sans-semibold text-[11.5px]"
						style={{ color: accent }}
					>
						{badgeCount}
					</Text>
				</View>
			) : null}
		</Pressable>
	);
}

function RowSeparator() {
	return <View className="h-px bg-separator" />;
}
