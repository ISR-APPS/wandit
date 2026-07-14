import { localeMeta, locales } from "@wandit/internationalization";
import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import { router } from "expo-router";
import { cn, useThemeColor } from "heroui-native";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import {
	ActivityIndicator,
	FlatList,
	Keyboard,
	Pressable,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WanditIcon } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { useLocale } from "@/contexts/locale-context";
import { authClient } from "@/lib/auth-client";
import { disableAuthBypass } from "@/lib/dev-auth-bypass";
import { ICON_STROKE } from "@/shared/lib/brand";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

import { useProjects } from "../api/projects.queries";
import { foldProjectSearchText, formatShortRelativeTime } from "../lib/helpers";
import { ProjectListItem } from "./project-list-item";

// Minimal structural type: @react-navigation/drawer is not a direct
// dependency (pnpm isolated node-linker), so type only what is used.
type ProjectsDrawerProps = {
	navigation: {
		addListener?: (event: "drawerClose", callback: () => void) => () => void;
		closeDrawer: () => void;
	};
};

/** Custom drawer content: search/filter row, create row, projects, account. */
export function ProjectsDrawer({ navigation }: ProjectsDrawerProps) {
	const insets = useSafeAreaInsets();
	const { data: session } = authClient.useSession();
	const { t } = useTranslation();
	const nativeDictionary = useDictionary().native;
	const { locale, setLocale } = useLocale();
	const accent = useThemeColor("accent");
	const muted = useThemeColor("muted");
	const { isDark } = useAppTheme();
	const iconStroke = isDark ? ICON_STROKE.dark : ICON_STROKE.light;
	const [accountOpen, setAccountOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const searchInputRef = useRef<TextInput>(null);
	const projectsQuery = useProjects();
	const projects = projectsQuery.data ?? [];
	const normalizedSearchQuery = foldProjectSearchText(searchQuery.trim(), locale);
	const visibleProjects = useMemo(() => {
		if (!normalizedSearchQuery) {
			return projects;
		}

		return projects.filter((project) =>
			foldProjectSearchText(project.name, locale).includes(
				normalizedSearchQuery,
			),
		);
	}, [locale, normalizedSearchQuery, projects]);

	const userName = session?.user?.name?.trim();
	const initial = (userName || session?.user?.email || "W")
		.charAt(0)
		.toUpperCase();

	useEffect(() => {
		if (!searchOpen) {
			return;
		}

		const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
		return () => cancelAnimationFrame(frame);
	}, [searchOpen]);

	const resetSearch = useCallback(() => {
		setSearchQuery("");
		setSearchOpen(false);
	}, []);

	useEffect(() => {
		return navigation.addListener?.("drawerClose", resetSearch);
	}, [navigation, resetSearch]);

	function openProject(projectId: string) {
		Keyboard.dismiss();
		resetSearch();
		navigation.closeDrawer();
		router.push(`/project/${projectId}`);
	}

	function createNewProject() {
		Keyboard.dismiss();
		resetSearch();
		navigation.closeDrawer();
		router.push("/");
	}

	function closeSearch() {
		resetSearch();
	}

	return (
		<View
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }}
		>
			{/* Search + filter row (§3.1). */}
			<View className="flex-row items-center gap-2 px-4">
				{searchOpen ? (
					<>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("native.drawer.cancelSearchLabel")}
							onPress={closeSearch}
							className="h-[42px] w-[42px] items-center justify-center rounded-full border border-border bg-surface active:scale-[0.98] dark:bg-surface-tertiary/65"
						>
							<WanditIcon name="close" size={14} color={iconStroke} />
						</Pressable>
						<View className="h-[42px] flex-1 flex-row items-center gap-2 rounded-full border border-border bg-surface px-3.5 dark:bg-surface-tertiary/65">
							<WanditIcon name="search" size={15} color={muted} />
							<TextInput
								ref={searchInputRef}
								autoFocus
								value={searchQuery}
								onChangeText={setSearchQuery}
								placeholder={t("native.drawer.searchPlaceholder")}
								placeholderTextColor={muted}
								returnKeyType="search"
								selectionColor={accent}
								className="h-full flex-1 font-sans-medium text-[14px] text-foreground"
								style={{ paddingVertical: 0 }}
							/>
						</View>
					</>
				) : (
					<>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("native.drawer.searchLabel")}
							onPress={() => setSearchOpen(true)}
							className="h-[42px] w-[42px] items-center justify-center rounded-full border border-border bg-surface active:scale-[0.98] dark:bg-surface-tertiary/65"
						>
							<WanditIcon name="search" size={16} color={iconStroke} />
						</Pressable>
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
					</>
				)}
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

			<View className="mt-3 flex-1">
				{projectsQuery.isLoading ? (
					<DrawerListState>
						<ActivityIndicator
							color={accent}
							accessibilityLabel={t("native.drawer.projectsLoading")}
						/>
						<Text className="mt-3 text-center font-sans-medium text-[13px] text-muted">
							{t("native.drawer.projectsLoading")}
						</Text>
					</DrawerListState>
				) : projectsQuery.isError ? (
					<DrawerListState>
						<Text className="text-center font-sans-medium text-[13px] text-muted">
							{t("native.drawer.projectsError")}
						</Text>
						<Pressable
							accessibilityRole="button"
							onPress={() => void projectsQuery.refetch()}
							className="mt-3 rounded-full border border-border bg-surface px-4 py-2 active:scale-[0.98] dark:bg-surface-tertiary/65"
						>
							<Text className="font-sans-semibold text-[13px] text-foreground">
								{t("native.drawer.retry")}
							</Text>
						</Pressable>
					</DrawerListState>
				) : (
					<FlatList
						data={visibleProjects}
						keyExtractor={(project) => project.id}
						className="flex-1"
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={{
							paddingHorizontal: 16,
							paddingBottom: 20,
							flexGrow: visibleProjects.length === 0 ? 1 : undefined,
						}}
						ListEmptyComponent={
							<DrawerListState>
								<Text className="text-center font-sans-medium text-[13px] text-muted">
									{normalizedSearchQuery
										? t("native.drawer.emptySearch")
										: t("native.drawer.emptyProjects")}
								</Text>
							</DrawerListState>
						}
						renderItem={({ item }) => (
							<ProjectListItem
								project={item}
								updatedAtLabel={formatShortRelativeTime(
									item.updatedAt,
									nativeDictionary.relativeTime,
								)}
								onPress={() => openProject(item.id)}
							/>
						)}
					/>
				)}
			</View>

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

function DrawerListState({ children }: { children: ReactNode }) {
	return (
		<View className="flex-1 items-center justify-center px-6 py-10">
			{children}
		</View>
	);
}
