import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";

import { WanditIcon, type WanditIconName } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { ICON_STROKE } from "@/shared/lib/brand";
import { AppBottomSheet } from "@/shared/ui/bottom-sheet";

export type AttachSource = "files" | "camera" | "library";

type AttachSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (source: AttachSource) => void;
	/** Opens the skill select dialog (the sheet closes itself first). */
	onAttachSkill: () => void;
	/** Attached-skill count shown on the skill row. */
	skillCount: number;
};

type AttachRowKey =
	| "native.attach.browseFiles"
	| "native.attach.takePhoto"
	| "native.attach.photoLibrary";

const ROWS: {
	source: AttachSource;
	icon: WanditIconName;
	key: AttachRowKey;
}[] = [
	{ source: "files", icon: "folder", key: "native.attach.browseFiles" },
	{ source: "camera", icon: "camera", key: "native.attach.takePhoto" },
	{ source: "library", icon: "image", key: "native.attach.photoLibrary" },
];

/**
 * The [+] action sheet (dark prototype §2b styling): attach a file / photo /
 * library shot, or jump to the skill select dialog. Attachment picking is
 * UI-only for now — expo-image-picker wiring comes later.
 */
export function AttachSheet({
	isOpen,
	onOpenChange,
	onPick,
	onAttachSkill,
	skillCount,
}: AttachSheetProps) {
	const { t } = useTranslation();
	const { isDark } = useAppTheme();
	const accent = useThemeColor("accent");
	const iconStroke = isDark ? ICON_STROKE.dark : ICON_STROKE.light;

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
						{ROWS.map((row) => (
							<Pressable
								key={row.source}
								accessibilityRole="button"
								onPress={() => {
									onPick(row.source);
									onOpenChange(false);
								}}
								className="flex-row items-center gap-3 border-separator border-b px-4 py-[15px] active:bg-surface-secondary"
							>
								<WanditIcon name={row.icon} size={18} color={iconStroke} />
								<Text className="font-sans-medium text-[15px] text-foreground">
									{t(row.key)}
								</Text>
							</Pressable>
						))}
						<Pressable
							accessibilityRole="button"
							onPress={() => {
								onOpenChange(false);
								onAttachSkill();
							}}
							className="flex-row items-center gap-3 px-4 py-[15px] active:bg-surface-secondary"
						>
							<WanditIcon name="spark" size={18} color={accent} />
							<Text className="flex-1 font-sans-medium text-[15px] text-foreground">
								{t("native.attach.attachSkill")}
							</Text>
							{skillCount > 0 ? (
								<View className="h-[22px] min-w-[22px] items-center justify-center rounded-full bg-accent/10 px-1.5">
									<Text
										className="font-sans-semibold text-[11.5px]"
										style={{ color: accent }}
									>
										{skillCount}
									</Text>
								</View>
							) : null}
						</Pressable>
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
