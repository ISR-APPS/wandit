import { useTranslation } from "@wandit/internationalization/react";
import { useNavigation } from "expo-router";
import { useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconCircleButton } from "@/components/icon-circle-button";
import { WanditIcon } from "@/components/wandit-icon";

type ChatHeaderProps = {
	projectName: string;
	onOpenProjectSheet: () => void;
	/** Ember gradient when the project has a page; muted pill on empty state. */
	previewActive: boolean;
};

// Minimal structural drawer access: @react-navigation/* is not a direct
// dependency, so walk parents until a navigator exposes openDrawer.
type DrawerLike = {
	openDrawer?: () => void;
	getParent?: () => DrawerLike | undefined;
};

function openNearestDrawer(navigation: DrawerLike) {
	let current: DrawerLike | undefined = navigation;
	while (current && typeof current.openDrawer !== "function") {
		current = current.getParent?.();
	}
	current?.openDrawer?.();
}

/** Project chat header: drawer · title pill (opens sheet) · preview FAB. */
export function ChatHeader({
	projectName,
	onOpenProjectSheet,
	previewActive,
}: ChatHeaderProps) {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const navigation = useNavigation();
	const muted = useThemeColor("muted");

	return (
		<View
			className="flex-row items-center gap-2 px-3.5 pb-2.5"
			style={{ paddingTop: insets.top + 8 }}
		>
			<IconCircleButton
				icon="menu"
				size={42}
				iconSize={17}
				onPress={() => openNearestDrawer(navigation as DrawerLike)}
				accessibilityLabel={t("common.sidebarToggle")}
			/>
			<Pressable
				accessibilityRole="button"
				onPress={onOpenProjectSheet}
				className="h-[42px] min-w-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-3.5 active:scale-[0.98] dark:bg-surface-tertiary/65"
			>
				<Text
					numberOfLines={1}
					className="max-w-[180px] font-sans-semibold text-[14px] text-foreground"
				>
					{projectName}
				</Text>
				<WanditIcon name="caretDown" size={13} color={muted} strokeWidth={2} />
			</Pressable>
			{/* TODO: page preview screen — button is present but inert for now. */}
			<IconCircleButton
				icon="play"
				size={42}
				iconSize={15}
				variant={previewActive ? "ember" : "chrome"}
				iconColor={previewActive ? undefined : muted}
				accessibilityLabel={t("native.workspace.previewLabel")}
			/>
		</View>
	);
}
