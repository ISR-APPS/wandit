import { localeMeta, locales } from "@wandit/internationalization";
import { useTranslation } from "@wandit/internationalization/react";
import { router } from "expo-router";
import { cn, useThemeColor } from "heroui-native";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WanditIcon } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { useLocale } from "@/contexts/locale-context";
import { authClient } from "@/lib/auth-client";
import { disableAuthBypass } from "@/lib/dev-auth-bypass";
import { ICON_STROKE } from "@/shared/lib/brand";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

import { MOCK_PROJECTS } from "../lib/constants";
import { ProjectListItem } from "./project-list-item";

// Minimal structural type: @react-navigation/drawer is not a direct
// dependency (pnpm isolated node-linker), so type only what is used.
type ProjectsDrawerProps = {
	navigation: {
		closeDrawer: () => void;
	};
};

/** Custom drawer content: search/filter row, create row, projects, account. */
export function ProjectsDrawer({ navigation }: ProjectsDrawerProps) {
	const insets = useSafeAreaInsets();
	const { data: session } = authClient.useSession();
	const { t } = useTranslation();
	const { locale, setLocale } = useLocale();
	const accent = useThemeColor("accent");
	const muted = useThemeColor("muted");
	const { isDark } = useAppTheme();
	const iconStroke = isDark ? ICON_STROKE.dark : ICON_STROKE.light;
	const [accountOpen, setAccountOpen] = useState(false);

	const userName = session?.user?.name?.trim();
	const initial = (userName || session?.user?.email || "W")
		.charAt(0)
		.toUpperCase();

	function openProject(projectId: string) {
		navigation.closeDrawer();
		router.push(`/project/${projectId}`);
	}

	function createNewProject() {
		navigation.closeDrawer();
		router.push("/");
	}

	return (
		<View
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }}
		>
			{/* Search + filter row (§3.1) — visual stubs until search is wired. */}
			<View className="flex-row items-center gap-2 px-4">
				<View className="h-[42px] w-[42px] items-center justify-center rounded-full border border-border bg-surface dark:bg-surface-tertiary/65">
					<WanditIcon name="search" size={16} color={iconStroke} />
				</View>
				<View className="h-[42px] flex-row items-center gap-[7px] rounded-full border border-border bg-surface px-3.5 dark:bg-surface-tertiary/65">
					<Text className="font-sans-semibold text-[13.5px] text-foreground">
						{t("native.drawer.filterCreatedByMe")}
					</Text>
					<WanditIcon
						name="caretDown"
						size={12}
						color={muted}
						strokeWidth={2}
					/>
				</View>
			</View>

			{/* Create new project (§3.2). */}
			<Pressable
				accessibilityRole="button"
				onPress={createNewProject}
				className="mx-4 mt-[18px] flex-row items-center gap-3 active:scale-[0.98]"
			>
				<View className="h-[50px] w-[50px] items-center justify-center rounded-[14px] bg-surface-secondary dark:bg-surface-tertiary">
					<WanditIcon name="plus" size={19} color={iconStroke} />
				</View>
				<Text className="font-sans-semibold text-[15px] text-foreground">
					{t("native.drawer.createProject")}
				</Text>
			</Pressable>

			{/* TODO: fetch the real project list (features/projects/api/). */}
			<FlatList
				data={MOCK_PROJECTS}
				keyExtractor={(project) => project.id}
				className="mt-3 flex-1"
				contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
				renderItem={({ item }) => (
					<ProjectListItem
						project={item}
						onPress={() => openProject(item.id)}
					/>
				)}
			/>

			{accountOpen ? (
				<View className="mx-4 mb-3 gap-3 rounded-[18px] border border-border bg-surface p-3.5 dark:bg-surface-secondary">
					<View className="gap-2">
						<Text className="font-mono text-[9.5px] text-muted uppercase tracking-[1.2px]">
							{t("native.drawer.language")}
						</Text>
						<View className="flex-row gap-2">
							{locales.map((item) => {
								const isActive = item === locale;
								return (
									<Pressable
										key={item}
										onPress={() => setLocale(item)}
										accessibilityRole="button"
										accessibilityState={{ selected: isActive }}
										className={cn(
											"flex-1 items-center rounded-full px-3 py-1.5",
											isActive
												? "bg-accent"
												: "bg-surface-secondary dark:bg-surface-tertiary",
										)}
									>
										<Text
											className={cn(
												"font-sans-medium text-sm",
												isActive ? "text-accent-foreground" : "text-muted",
											)}
										>
											{localeMeta[item].nativeLabel}
										</Text>
									</Pressable>
								);
							})}
						</View>
					</View>
					<Pressable
						accessibilityRole="button"
						onPress={() => {
							// Also clears the dev auth bypass so we land back on Welcome.
							disableAuthBypass();
							authClient.signOut();
						}}
						className="items-center rounded-full bg-surface-secondary py-2 active:opacity-80 dark:bg-surface-tertiary"
					>
						<Text className="font-sans-semibold text-[13.5px] text-foreground">
							{t("native.drawer.signOut")}
						</Text>
					</Pressable>
					<Text
						numberOfLines={1}
						className="text-center text-[11px] text-muted"
					>
						{session?.user?.email}
					</Text>
				</View>
			) : null}

			{/* Account footer (§3.4): "My Wandit" pill + gradient avatar. */}
			<View className="flex-row items-center gap-2.5 px-4">
				<Pressable
					accessibilityRole="button"
					accessibilityState={{ expanded: accountOpen }}
					onPress={() => setAccountOpen((open) => !open)}
					className="h-[52px] flex-1 flex-row items-center gap-2.5 rounded-full border border-border bg-surface ps-2 pe-3.5 active:scale-[0.98] dark:bg-surface-tertiary/65"
				>
					<View className="h-9 w-9 items-center justify-center rounded-full bg-accent/15">
						<WanditIcon name="spark" size={14} color={accent} />
					</View>
					<Text className="flex-1 font-sans-semibold text-[14px] text-foreground">
						{t("native.drawer.myWandit")}
					</Text>
					<WanditIcon
						name="caretDown"
						size={12}
						color={muted}
						strokeWidth={2}
					/>
				</Pressable>
				<View className="relative h-[46px] w-[46px] items-center justify-center overflow-hidden rounded-full">
					<BrandGradientFill radius={23} />
					<Text className="font-sans-bold text-[16px] text-white">
						{initial}
					</Text>
				</View>
			</View>
		</View>
	);
}
