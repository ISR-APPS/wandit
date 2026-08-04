import { useTranslation } from "@wandit/internationalization/react";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { WanditIcon, type WanditIconName } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { CreditsCard } from "@/features/credits";
import { ICON_FAINT, ICON_STROKE } from "@/shared/lib/brand";
import { AppBottomSheet } from "@/shared/ui/bottom-sheet";

type ProjectView = "page" | "assets" | "marketing" | "leads";

type ProjectSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
};

type ViewTileKey =
	| "native.projectSheet.views.page"
	| "native.projectSheet.views.assets"
	| "native.projectSheet.views.marketing"
	| "native.projectSheet.views.leads";

const VIEW_TILES: {
	view: ProjectView;
	icon: WanditIconName;
	key: ViewTileKey;
}[] = [
	{ view: "page", icon: "browser", key: "native.projectSheet.views.page" },
	{
		view: "assets",
		icon: "imageTile",
		key: "native.projectSheet.views.assets",
	},
	{
		view: "marketing",
		icon: "megaphone",
		key: "native.projectSheet.views.marketing",
	},
	{ view: "leads", icon: "users", key: "native.projectSheet.views.leads" },
];

/**
 * Bottom sheet opened from the project title pill: credits, the four project
 * views, then settings rows (light prototype §4).
 */
export function ProjectSheet({
	isOpen,
	onOpenChange,
	projectId,
}: ProjectSheetProps) {
	const { t } = useTranslation();
	const { isDark, toggleTheme } = useAppTheme();
	// Prototype icon strokes are softer than foreground; chevrons fainter still.
	const iconStroke = isDark ? ICON_STROKE.dark : ICON_STROKE.light;
	const iconFaint = isDark ? ICON_FAINT.dark : ICON_FAINT.light;

	function openView(view: ProjectView) {
		onOpenChange(false);
		router.push(`/project/${projectId}/${view}`);
	}

	function openSettings() {
		onOpenChange(false);
		router.push(`/project/${projectId}/settings`);
	}

	return (
		<AppBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
			<AppBottomSheet.Portal>
				<AppBottomSheet.Overlay />
				<AppBottomSheet.Content
					backgroundClassName="bg-background rounded-t-[26px]"
					handleIndicatorClassName="w-[42px] bg-foreground/15"
					contentContainerClassName="px-4 pb-12"
				>
					<CreditsCard />

					<Text className="mx-0.5 mt-4 mb-2 font-mono text-[10px] text-muted uppercase tracking-[1.4px]">
						{t("native.projectSheet.viewsLabel")}
					</Text>
					<View className="flex-row gap-2">
						{VIEW_TILES.map((tile) => (
							<Pressable
								key={tile.view}
								accessibilityRole="button"
								onPress={() => openView(tile.view)}
								className="flex-1 items-center gap-[7px] rounded-[16px] border border-border bg-surface px-1 pt-[13px] pb-[11px] active:scale-95 dark:bg-surface-secondary"
							>
								<WanditIcon
									name={tile.icon}
									size={19}
									color={iconStroke}
									strokeWidth={1.8}
								/>
								<Text className="font-sans-semibold text-[11px] text-foreground">
									{t(tile.key)}
								</Text>
							</Pressable>
						))}
					</View>

					<View className="mt-4 overflow-hidden rounded-[18px] border border-border bg-surface dark:bg-surface-secondary">
						<Pressable
							accessibilityRole="button"
							onPress={openSettings}
							className="min-h-[52px] flex-row items-center gap-3 border-separator border-b px-3.5 active:bg-surface-secondary"
						>
							<WanditIcon
								name="sun"
								size={17}
								color={iconStroke}
								strokeWidth={1.7}
							/>
							<Text className="flex-1 font-sans-medium text-[14.5px] text-foreground">
								{t("native.projectSheet.settings")}
							</Text>
							<WanditIcon name="chevronRight" size={12} color={iconFaint} />
						</Pressable>
						<Pressable
							accessibilityRole="button"
							className="min-h-[52px] flex-row items-center gap-3 border-separator border-b px-3.5 active:bg-surface-secondary"
						>
							{/* TODO: rename dialog once the projects API lands. */}
							<WanditIcon
								name="pencil"
								size={16}
								color={iconStroke}
								strokeWidth={1.7}
							/>
							<Text className="flex-1 font-sans-medium text-[14.5px] text-foreground">
								{t("native.projectSheet.rename")}
							</Text>
							<WanditIcon name="chevronRight" size={12} color={iconFaint} />
						</Pressable>
						<Pressable
							accessibilityRole="button"
							onPress={toggleTheme}
							className="min-h-[52px] flex-row items-center gap-3 px-3.5 active:bg-surface-secondary"
						>
							<WanditIcon
								name="contrast"
								size={16}
								color={iconStroke}
								strokeWidth={1.7}
							/>
							<Text className="flex-1 font-sans-medium text-[14.5px] text-foreground">
								{t("native.projectSheet.appearance")}
							</Text>
							<Text className="text-[13px] text-muted">
								{isDark
									? t("native.projectSheet.appearanceDark")
									: t("native.projectSheet.appearanceLight")}
							</Text>
							<WanditIcon name="chevronRight" size={12} color={iconFaint} />
						</Pressable>
					</View>
				</AppBottomSheet.Content>
			</AppBottomSheet.Portal>
		</AppBottomSheet>
	);
}
