import { useQueryClient } from "@tanstack/react-query";
import type { Project } from "@wandit/contracts";
import type { Locale } from "@wandit/internationalization";
import { localeMeta } from "@wandit/internationalization";
import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { cn, useThemeColor } from "heroui-native";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	AccessibilityInfo,
	ActivityIndicator,
	Keyboard,
	Platform,
	Pressable,
	ScrollView,
	SectionList,
	Text,
	TextInput,
	View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WanditIcon } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { useLocale } from "@/contexts/locale-context";
import { authClient } from "@/lib/auth-client";
import { disableAuthBypass } from "@/lib/dev-auth-bypass";
import { ICON_STROKE } from "@/shared/lib/brand";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";
import { AppScrollShadow } from "@/shared/ui/scroll-shadow";
import { AppSkeletonGroup } from "@/shared/ui/skeleton-group";

import { useInfiniteProjects, useProjects } from "../api/projects.queries";
import { formatShortRelativeTime } from "../lib/helpers";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { AccountSheet, LanguageSheet } from "./drawer-account-sheet";
import { DrawerProjectRow } from "./drawer-project-row";
import { DrawerToast, useDrawerToast } from "./drawer-toast";
import { ProjectActionsSheet } from "./project-actions-sheet";
import { RenameProjectDialog } from "./rename-project-dialog";

// Minimal structural type: @react-navigation/drawer is not a direct
// dependency (pnpm isolated node-linker), so type only what is used.
// expo-router's vendored drawer emits no "drawerClose" — the close signal
// is "transitionStart" with closing=true (it fires on open too).
type ProjectsDrawerProps = {
	navigation: {
		addListener?: (
			event: "transitionStart",
			callback: (event: { data: { closing: boolean } }) => void,
		) => () => void;
		closeDrawer: () => void;
	};
};

type StatusFilter = "all" | "building" | "live" | "drafts";

const FILTER_STATUS: Record<Exclude<StatusFilter, "all">, Project["status"]> = {
	building: "publishing",
	live: "published",
	drafts: "draft",
};

type DrawerSheet = "actions" | "rename" | "delete" | "account" | "language";

type TimeBucket = "today" | "week" | "earlier";

const BUCKET_ORDER: readonly TimeBucket[] = ["today", "week", "earlier"];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function bucketOf(updatedAt: string, now: Date): TimeBucket {
	const date = new Date(updatedAt);
	const diff = now.getTime() - date.getTime();
	// Clamp future timestamps (clock skew) into "today", matching the
	// relative-time formatter's Math.max(0, …) clamp.
	if (diff <= 0 || date.toDateString() === now.toDateString()) {
		return "today";
	}
	return diff < WEEK_MS ? "week" : "earlier";
}

function projectKeyExtractor(project: Project): string {
	return project.id;
}

/**
 * Custom drawer content, rebuilt to the "Filter, recognise, act" prototype:
 * search + new-project header, status filter chips with counts, time-grouped
 * rows with build previews, press-and-hold project actions, and an account
 * footer that opens the account/language sheets.
 */
export function ProjectsDrawer({ navigation }: ProjectsDrawerProps) {
	const queryClient = useQueryClient();
	const insets = useSafeAreaInsets();
	const pathname = usePathname();
	const { data: session } = authClient.useSession();
	const { dir, t } = useTranslation();
	const nativeDictionary = useDictionary().native;
	const { locale, setLocale } = useLocale();
	const background = useThemeColor("background");
	const accent = useThemeColor("accent");
	const accentForeground = useThemeColor("accent-foreground");
	const muted = useThemeColor("muted");
	const { isDark } = useAppTheme();
	const iconStroke = isDark ? ICON_STROKE.dark : ICON_STROKE.light;

	const [searchFocused, setSearchFocused] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
	const [filter, setFilter] = useState<StatusFilter>("all");
	const [sheet, setSheet] = useState<DrawerSheet | null>(null);
	// Kept while a sheet closes so its project card doesn't blank mid-animation.
	const [activeProject, setActiveProject] = useState<Project | null>(null);
	const searchInputRef = useRef<TextInput>(null);
	const toast = useDrawerToast();
	// A sheet hands off to a dialog/sheet after its own close animation. The
	// drawer owns the 220ms delay so a drawer close can cancel the handoff —
	// the sheets portal outside the drawer and must never open over a closed
	// drawer.
	const pendingSheetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearPendingSheet = useCallback(() => {
		if (pendingSheetRef.current) {
			clearTimeout(pendingSheetRef.current);
			pendingSheetRef.current = null;
		}
	}, []);

	const scheduleSheet = useCallback(
		(kind: DrawerSheet) => {
			clearPendingSheet();
			pendingSheetRef.current = setTimeout(() => {
				pendingSheetRef.current = null;
				setSheet(kind);
			}, 220);
		},
		[clearPendingSheet],
	);

	useEffect(() => clearPendingSheet, [clearPendingSheet]);

	const isFiltered = filter !== "all";

	// The full list powers the chip counts and the filtered views; the paged
	// list keeps the All view's server search + infinite scroll. While a
	// filter chip is active the rows come from the full list, so keep the
	// paged query keyed to the cached unsearched All list — typing must not
	// fire server searches for a hidden view.
	const fullQuery = useProjects();
	const projectsQuery = useInfiniteProjects(
		isFiltered ? "" : debouncedSearchQuery,
	);
	const pagedProjects = useMemo(() => {
		const projectsById = new Map<string, Project>();

		for (const page of projectsQuery.data?.pages ?? []) {
			for (const project of page.items) {
				if (!projectsById.has(project.id)) {
					projectsById.set(project.id, project);
				}
			}
		}

		return [...projectsById.values()];
	}, [projectsQuery.data?.pages]);

	const normalizedSearchQuery = searchQuery.trim();
	const normalizedDebouncedSearchQuery = debouncedSearchQuery.trim();
	const hasSearchText = searchQuery.length > 0;
	const hasSearchQuery = normalizedSearchQuery.length > 0;
	const searchRequestMatchesInput =
		normalizedSearchQuery === normalizedDebouncedSearchQuery;

	const fullProjects = useMemo(() => fullQuery.data ?? [], [fullQuery.data]);
	const counts = useMemo(
		() =>
			fullQuery.data
				? {
						all: fullProjects.length,
						building: fullProjects.filter((p) => p.status === "publishing")
							.length,
						live: fullProjects.filter((p) => p.status === "published").length,
						drafts: fullProjects.filter((p) => p.status === "draft").length,
					}
				: null,
		[fullProjects, fullQuery.data],
	);

	// Filtered views search client-side over the full list, in place.
	const filteredProjects = useMemo(() => {
		if (!isFiltered) {
			return pagedProjects;
		}
		const status = FILTER_STATUS[filter];
		const query = normalizedSearchQuery.toLowerCase();
		return fullProjects.filter((project) => {
			if (project.status !== status) {
				return false;
			}
			if (!query) {
				return true;
			}
			return `${project.name} ${project.publishedSlug ?? ""}`
				.toLowerCase()
				.includes(query);
		});
	}, [filter, fullProjects, isFiltered, normalizedSearchQuery, pagedProjects]);

	const sections = useMemo(() => {
		const now = new Date();
		const byBucket: Record<TimeBucket, Project[]> = {
			today: [],
			week: [],
			earlier: [],
		};
		for (const project of filteredProjects) {
			byBucket[bucketOf(project.updatedAt, now)].push(project);
		}
		const labels: Record<TimeBucket, string> = {
			today: t("native.drawer.groupToday"),
			week: t("native.drawer.groupThisWeek"),
			earlier: t("native.drawer.groupEarlier"),
		};
		return BUCKET_ORDER.filter((bucket) => byBucket[bucket].length > 0).map(
			(bucket) => ({
				key: bucket,
				label: labels[bucket],
				data: byBucket[bucket],
			}),
		);
	}, [filteredProjects, t]);

	const activeSourceLoading = isFiltered
		? fullQuery.isLoading
		: projectsQuery.isLoading;
	const isInitialQueryError = isFiltered
		? fullQuery.isError
		: projectsQuery.isError && !projectsQuery.isFetchNextPageError;
	const searchResultTotal = projectsQuery.data?.pages[0]?.total;
	const showSearchActivity =
		!isFiltered &&
		projectsQuery.isFetching &&
		!projectsQuery.isFetchingNextPage &&
		!projectsQuery.isLoading &&
		(projectsQuery.isPlaceholderData ||
			normalizedDebouncedSearchQuery.length > 0) &&
		searchRequestMatchesInput;
	const showSearchResultCount =
		!isFiltered &&
		hasSearchQuery &&
		searchRequestMatchesInput &&
		!projectsQuery.isPlaceholderData &&
		searchResultTotal !== undefined &&
		!isInitialQueryError;
	const searchResultStatus = showSearchResultCount
		? t("native.drawer.resultCount", { count: searchResultTotal })
		: isFiltered && hasSearchQuery
			? t("native.drawer.resultCount", { count: filteredProjects.length })
			: null;
	const visibleSearchStatus = searchResultStatus
		? searchResultStatus
		: hasSearchQuery && !isInitialQueryError && !isFiltered
			? t("native.drawer.searchingProjects")
			: null;

	const userName = session?.user?.name?.trim();
	const userEmail = session?.user?.email?.trim();
	const accountTitle = userName || t("native.drawer.myWandit");
	const initial = (userName || userEmail || "W").charAt(0).toUpperCase();

	useEffect(() => {
		if (!searchQuery.trim()) {
			return;
		}

		const timeout = setTimeout(() => {
			setDebouncedSearchQuery(searchQuery);
		}, 300);

		return () => clearTimeout(timeout);
	}, [searchQuery]);

	function updateSearchQuery(value: string) {
		setSearchQuery(value);
		if (!value.trim()) {
			setDebouncedSearchQuery("");
		}
	}

	const resetSearch = useCallback(() => {
		setSearchQuery("");
		setDebouncedSearchQuery("");
		setSearchFocused(false);
	}, []);

	useEffect(() => {
		return navigation.addListener?.("transitionStart", (event) => {
			if (!event.data.closing) {
				return;
			}
			Keyboard.dismiss();
			resetSearch();
			clearPendingSheet();
			// The sheets portal outside the drawer — never leave one floating
			// over a closed drawer.
			setSheet(null);
		});
	}, [navigation, resetSearch, clearPendingSheet]);

	useEffect(() => {
		if (Platform.OS === "ios" && searchResultStatus) {
			AccessibilityInfo.announceForAccessibility(searchResultStatus);
		}
	}, [searchResultStatus]);

	const openProject = useCallback(
		(project: Project) => {
			Keyboard.dismiss();
			resetSearch();
			navigation.closeDrawer();
			router.push(`/project/${project.id}`);
		},
		[navigation, resetSearch],
	);

	function createNewProject() {
		Keyboard.dismiss();
		resetSearch();
		navigation.closeDrawer();
		router.push("/");
	}

	function clearSearch() {
		setSearchQuery("");
		setDebouncedSearchQuery("");
		searchInputRef.current?.focus();
	}

	const openProjectActions = useCallback((project: Project) => {
		void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
			() => undefined,
		);
		setActiveProject(project);
		setSheet("actions");
	}, []);

	// Sheet-specific close handlers: each only clears its own kind, so a
	// 220ms handoff to the next sheet is never stomped by the closing one.
	const closeSheetOfKind = (kind: DrawerSheet) => (open: boolean) => {
		if (!open) {
			setSheet((current) => (current === kind ? null : current));
		}
	};

	function metaFor(project: Project): string {
		if (project.status === "publishing") {
			return t("native.drawer.buildingMeta");
		}
		if (project.status === "published" && project.publishedSlug) {
			return `${project.publishedSlug}${t("projects.publishedDomain")} · ${t(
				"projects.leadCount",
				{ count: project.leadCount },
			)}`;
		}
		return t("native.drawer.draftMeta", {
			time: formatShortRelativeTime(
				project.updatedAt,
				nativeDictionary.relativeTime,
			),
		});
	}

	function openLivePage(project: Project) {
		if (!project.publishedSlug) {
			return;
		}
		const host = `${project.publishedSlug}${t("projects.publishedDomain")}`;
		void WebBrowser.openBrowserAsync(`https://${host}`).catch(() => undefined);
	}

	function handleDeleted(project: Project) {
		toast.show(t("native.drawer.deleted"));
		// The open route may be the deleted project — don't leave a dead screen.
		if (pathname?.startsWith(`/project/${project.id}`)) {
			router.replace("/");
		}
	}

	function signOut() {
		// Also clears the dev auth bypass so we land back on Welcome.
		disableAuthBypass();
		// Authenticated query keys are intentionally user-agnostic. Clear
		// them before another account can mount and see fresh cached data.
		queryClient.clear();
		void authClient.signOut();
	}

	function selectLocale(next: Locale) {
		setLocale(next);
	}

	const loadNextPage = useCallback(() => {
		if (
			isFiltered ||
			!projectsQuery.hasNextPage ||
			projectsQuery.isFetchingNextPage ||
			projectsQuery.isFetchNextPageError ||
			projectsQuery.isPlaceholderData
		) {
			return;
		}

		void projectsQuery.fetchNextPage();
	}, [
		isFiltered,
		projectsQuery.fetchNextPage,
		projectsQuery.hasNextPage,
		projectsQuery.isFetchNextPageError,
		projectsQuery.isFetchingNextPage,
		projectsQuery.isPlaceholderData,
	]);

	const retryActiveSource = () => {
		if (isFiltered) {
			void fullQuery.refetch();
		} else {
			void projectsQuery.refetch();
		}
	};

	// Stable renderItem + memoized row: search keystrokes and focus changes
	// must not rebuild every visible row subtree.
	const renderProjectRow = useCallback(
		({ item }: { item: Project }) => (
			<DrawerProjectRow
				accessibilityLabel={t("native.drawer.openProjectLabel", {
					project: item.name,
				})}
				project={item}
				updatedAtLabel={formatShortRelativeTime(
					item.updatedAt,
					nativeDictionary.relativeTime,
				)}
				onPress={openProject}
				onLongPress={openProjectActions}
			/>
		),
		[nativeDictionary.relativeTime, openProject, openProjectActions, t],
	);

	const filterChips: {
		key: StatusFilter;
		label: string;
		count: number | null;
	}[] = [
		{ key: "all", label: t("native.drawer.filterAll"), count: counts?.all ?? null },
		{
			key: "building",
			label: t("native.drawer.filterBuilding"),
			count: counts?.building ?? null,
		},
		{
			key: "live",
			label: t("native.drawer.filterLive"),
			count: counts?.live ?? null,
		},
		{
			key: "drafts",
			label: t("native.drawer.filterDrafts"),
			count: counts?.drafts ?? null,
		},
	];

	const emptyFilterDescription =
		filter === "building"
			? t("native.drawer.emptyBuildingDescription")
			: filter === "live"
				? t("native.drawer.emptyLiveDescription")
				: t("native.drawer.emptyDraftsDescription");

	return (
		<View
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }}
		>
			{/* Header: search + new project. */}
			<View className="mx-4 flex-row items-center gap-2">
				<View
					className={cn(
						"relative h-[46px] min-w-0 flex-1 flex-row items-center gap-2 rounded-full border bg-surface ps-4 pe-1 dark:bg-surface-tertiary/65",
						searchFocused
							? "border-accent bg-accent/5 dark:bg-accent/10"
							: "border-border",
					)}
				>
					{searchFocused ? (
						<View
							pointerEvents="none"
							className="absolute -inset-1 rounded-full border border-accent/25"
						/>
					) : null}
					<WanditIcon
						name="search"
						size={16}
						color={searchFocused ? accent : muted}
					/>
					<TextInput
						ref={searchInputRef}
						accessibilityRole="search"
						accessibilityLabel={t("native.drawer.searchLabel")}
						accessibilityState={{ busy: showSearchActivity }}
						autoCapitalize="none"
						autoCorrect={false}
						maxLength={200}
						value={searchQuery}
						onBlur={() => setSearchFocused(false)}
						onChangeText={updateSearchQuery}
						onFocus={() => setSearchFocused(true)}
						placeholder={t("native.drawer.searchPlaceholder")}
						placeholderTextColor={muted}
						returnKeyType="search"
						selectionColor={accent}
						className="h-full flex-1 font-sans-medium text-[14px] text-foreground"
						style={{
							paddingHorizontal: 0,
							paddingVertical: 0,
							textAlign: dir === "rtl" ? "right" : "left",
						}}
					/>
					{showSearchActivity ? (
						<View className="h-11 w-7 items-center justify-center">
							<ActivityIndicator accessible={false} size="small" color={accent} />
						</View>
					) : null}
					{hasSearchText ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("native.drawer.clearSearchLabel")}
							onPress={clearSearch}
							className="h-11 w-11 items-center justify-center rounded-full active:scale-[0.98] active:bg-surface-secondary dark:active:bg-surface-tertiary"
						>
							<WanditIcon name="close" size={14} color={iconStroke} />
						</Pressable>
					) : null}
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("native.drawer.newProjectLabel")}
					onPress={createNewProject}
					className="h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-accent active:scale-[0.94]"
					style={{ boxShadow: `0 7px 16px -8px ${accent}` }}
				>
					<WanditIcon
						name="plus"
						size={19}
						color={accentForeground}
						strokeWidth={2.2}
					/>
				</Pressable>
			</View>

			{/* Status filter chips. */}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				className="mt-3 max-h-[34px] shrink-0 grow-0"
				contentContainerClassName="items-center gap-1.5 px-4"
			>
				{filterChips.map((chip) => (
					<FilterChip
						key={chip.key}
						label={chip.label}
						count={chip.count}
						active={filter === chip.key}
						isBuilding={chip.key === "building"}
						showDot={chip.key === "building" && (counts?.building ?? 0) > 0}
						onPress={() => setFilter(chip.key)}
					/>
				))}
			</ScrollView>

			<View className="mt-2 flex-1">
				{visibleSearchStatus ? (
					<View className="min-h-[24px] justify-center px-5 pb-1">
						<Text
							accessible
							accessibilityRole="summary"
							accessibilityLiveRegion="polite"
							className="font-sans-medium text-[12.5px] text-muted"
						>
							{visibleSearchStatus}
						</Text>
					</View>
				) : null}
				{activeSourceLoading ? (
					<View className="flex-1 overflow-hidden px-4 pt-1">
						<ProjectListSkeleton
							loadingLabel={t("native.drawer.projectsLoading")}
						/>
					</View>
				) : isInitialQueryError ? (
					<DrawerListState>
						<Text
							accessibilityRole="alert"
							accessibilityLiveRegion="assertive"
							className="text-center font-sans-medium text-[13px] text-muted"
						>
							{t("native.drawer.projectsError")}
						</Text>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("native.drawer.retry")}
							onPress={retryActiveSource}
							className="mt-3 min-h-11 items-center justify-center rounded-full border border-border bg-surface px-4 active:scale-[0.98] dark:bg-surface-tertiary/65"
						>
							<Text className="font-sans-semibold text-[13px] text-foreground">
								{t("native.drawer.retry")}
							</Text>
						</Pressable>
					</DrawerListState>
				) : (
					<AppScrollShadow
						className="flex-1"
						color={background}
						orientation="vertical"
						size={28}
						visibility="bottom"
					>
						<SectionList
							accessibilityRole="list"
							accessibilityLabel={t("native.drawer.projectsListLabel")}
							accessibilityState={{ busy: projectsQuery.isFetching }}
							sections={sections}
							keyExtractor={projectKeyExtractor}
							className="flex-1"
							keyboardDismissMode="on-drag"
							keyboardShouldPersistTaps="handled"
							stickySectionHeadersEnabled={false}
							onEndReached={loadNextPage}
							onEndReachedThreshold={0.4}
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{
								paddingHorizontal: 16,
								paddingBottom: filteredProjects.length > 0 ? 56 : 20,
								flexGrow: filteredProjects.length === 0 ? 1 : undefined,
							}}
							renderSectionHeader={({ section }) => (
								<View className="flex-row items-center gap-2 bg-background py-2">
									<Text
										className="font-mono text-[9.5px] text-muted uppercase tracking-[1.3px]"
										style={{ writingDirection: "auto" }}
									>
										{section.label}
									</Text>
									<View className="h-px flex-1 bg-separator" />
								</View>
							)}
							ListEmptyComponent={
								!isFiltered &&
								(projectsQuery.isPlaceholderData ||
									(hasSearchQuery && !showSearchResultCount)) ? (
									<ProjectListSkeleton
										loadingLabel={t("native.drawer.projectsLoading")}
									/>
								) : hasSearchQuery ? (
									<DrawerEmptyState
										actionLabel={t("native.drawer.clearSearchLabel")}
										actionVariant="surface"
										announceChanges={false}
										description={t("native.drawer.emptySearchDescription", {
											query: normalizedSearchQuery,
										})}
										icon="search"
										onAction={clearSearch}
										title={t("native.drawer.emptySearchTitle")}
									/>
								) : isFiltered ? (
									<DrawerEmptyState
										announceChanges={false}
										description={emptyFilterDescription}
										icon="folder"
										title={t("native.drawer.emptyFilterTitle")}
									/>
								) : (
									<DrawerEmptyState
										actionLabel={t("native.drawer.createProject")}
										actionVariant="accent"
										announceChanges
										description={t("native.drawer.emptyProjectsDescription")}
										icon="folder"
										onAction={createNewProject}
										title={t("native.drawer.emptyProjectsTitle")}
									/>
								)
							}
							ListFooterComponent={
								!isFiltered && projectsQuery.isFetchingNextPage ? (
									<View className="items-center py-3">
										<ActivityIndicator
											accessibilityRole="progressbar"
											color={accent}
											accessibilityLabel={t("native.drawer.projectsLoading")}
										/>
									</View>
								) : !isFiltered && projectsQuery.isFetchNextPageError ? (
									<View className="items-center gap-2 py-3">
										<Text
											accessibilityRole="text"
											accessibilityLiveRegion="polite"
											className="text-center font-sans-medium text-[12px] text-muted"
										>
											{t("native.drawer.projectsError")}
										</Text>
										<Pressable
											accessibilityRole="button"
											accessibilityLabel={t("native.drawer.retry")}
											onPress={() => void projectsQuery.fetchNextPage()}
											className="min-h-11 items-center justify-center rounded-full border border-border bg-surface px-4 active:scale-[0.98] dark:bg-surface-tertiary/65"
										>
											<Text className="font-sans-semibold text-[12px] text-foreground">
												{t("native.drawer.retry")}
											</Text>
										</Pressable>
									</View>
								) : null
							}
							renderItem={renderProjectRow}
						/>
					</AppScrollShadow>
				)}
			</View>

			{/* Account footer: one pill, the sheet holds the details. */}
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t("native.drawer.accountLabel")}
				onPress={() => setSheet("account")}
				className="mx-4 mt-2 h-[52px] flex-row items-center gap-3 rounded-full border border-border bg-surface ps-1.5 pe-3.5 active:bg-surface-secondary dark:bg-surface-secondary dark:active:bg-surface-tertiary"
			>
				<View className="relative h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
					<BrandGradientFill radius={20} />
					<Text className="font-sans-bold text-[15px] text-white">
						{initial}
					</Text>
				</View>
				<Text
					numberOfLines={1}
					className="min-w-0 flex-1 font-sans-semibold text-[14px] text-foreground"
				>
					{accountTitle}
				</Text>
				<WanditIcon name="caretDown" size={13} color={muted} strokeWidth={2} />
			</Pressable>

			<DrawerToast
				message={toast.message}
				bottomOffset={insets.bottom + 80}
			/>

			<ProjectActionsSheet
				isOpen={sheet === "actions"}
				onOpenChange={closeSheetOfKind("actions")}
				project={activeProject}
				projectMeta={activeProject ? metaFor(activeProject) : ""}
				onRename={() => scheduleSheet("rename")}
				onOpenLive={() => {
					if (activeProject) {
						openLivePage(activeProject);
					}
				}}
				onDelete={() => scheduleSheet("delete")}
			/>
			<RenameProjectDialog
				isOpen={sheet === "rename"}
				onOpenChange={closeSheetOfKind("rename")}
				project={activeProject}
				onRenamed={(name) => toast.show(t("native.drawer.renamed", { name }))}
				onError={() => toast.show(t("native.drawer.renameError"))}
			/>
			<DeleteProjectDialog
				isOpen={sheet === "delete"}
				onOpenChange={closeSheetOfKind("delete")}
				project={activeProject}
				onDeleted={handleDeleted}
				onError={() => toast.show(t("native.drawer.deleteError"))}
			/>
			<AccountSheet
				isOpen={sheet === "account"}
				onOpenChange={closeSheetOfKind("account")}
				userName={accountTitle}
				userEmail={userEmail ?? ""}
				initial={initial}
				currentLanguageLabel={localeMeta[locale].nativeLabel}
				onOpenLanguage={() => scheduleSheet("language")}
				onSignOut={signOut}
			/>
			<LanguageSheet
				isOpen={sheet === "language"}
				onOpenChange={closeSheetOfKind("language")}
				locale={locale}
				onSelect={selectLocale}
			/>
		</View>
	);
}

function FilterChip({
	label,
	count,
	active,
	isBuilding,
	showDot,
	onPress,
}: {
	label: string;
	count: number | null;
	active: boolean;
	isBuilding: boolean;
	showDot: boolean;
	onPress: () => void;
}) {
	const { t } = useTranslation();
	const accent = useThemeColor("accent");

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected: active }}
			accessibilityLabel={t("native.drawer.selectFilterLabel", {
				filter: label,
			})}
			onPress={onPress}
			className={cn(
				"h-[33px] shrink-0 flex-row items-center gap-1.5 rounded-full px-3 active:opacity-85",
				active
					? "bg-accent"
					: isBuilding
						? "border border-accent/35 bg-accent/5"
						: "border border-border bg-surface dark:bg-surface-tertiary/40",
			)}
		>
			{showDot ? (
				<Animated.View
					className="h-[5px] w-[5px] rounded-full"
					style={{
						backgroundColor: active ? "#FCFBF8" : accent,
						animationName: {
							"0%": { opacity: 1 },
							"50%": { opacity: 0.35 },
							"100%": { opacity: 1 },
						},
						animationDuration: "1600ms",
						animationIterationCount: "infinite",
						animationTimingFunction: "ease-in-out",
					}}
				/>
			) : null}
			<Text
				className={cn(
					"font-sans-medium text-[12.5px]",
					active
						? "text-accent-foreground"
						: isBuilding
							? "text-accent"
							: "text-foreground/85",
				)}
			>
				{label}
			</Text>
			{count !== null && count > 0 ? (
				<Text
					className={cn(
						"font-mono text-[11px]",
						active
							? "text-accent-foreground/70"
							: isBuilding
								? "text-accent/80"
								: "text-muted",
					)}
					style={{ writingDirection: "ltr" }}
				>
					{count}
				</Text>
			) : null}
		</Pressable>
	);
}

function DrawerListState({ children }: { children: ReactNode }) {
	return (
		<View className="flex-1 items-center justify-center px-6 py-10">
			{children}
		</View>
	);
}

type DrawerEmptyStateProps = {
	actionLabel?: string;
	actionVariant?: "accent" | "surface";
	announceChanges: boolean;
	description: string;
	icon: "folder" | "search";
	onAction?: () => void;
	title: string;
};

function DrawerEmptyState({
	actionLabel,
	actionVariant = "surface",
	announceChanges,
	description,
	icon,
	onAction,
	title,
}: DrawerEmptyStateProps) {
	const accent = useThemeColor("accent");

	return (
		<DrawerListState>
			<View className="mb-3 h-[50px] w-[50px] items-center justify-center rounded-[16px] bg-accent/10">
				<WanditIcon name={icon} size={19} color={accent} />
			</View>
			<View
				accessible
				accessibilityLiveRegion={announceChanges ? "polite" : undefined}
				className="items-center gap-1"
			>
				<Text className="text-center font-sans-semibold text-[15px] text-foreground">
					{title}
				</Text>
				<Text className="text-center font-sans-medium text-[12.5px] text-muted leading-5">
					{description}
				</Text>
			</View>
			{actionLabel && onAction ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={actionLabel}
					onPress={onAction}
					className={cn(
						"mt-4 min-h-11 items-center justify-center rounded-full px-5 active:scale-[0.98]",
						actionVariant === "accent"
							? "bg-accent"
							: "border border-border bg-surface dark:bg-surface-tertiary/65",
					)}
				>
					<Text
						className={cn(
							"font-sans-semibold text-[13px]",
							actionVariant === "accent"
								? "text-accent-foreground"
								: "text-foreground",
						)}
					>
						{actionLabel}
					</Text>
				</Pressable>
			) : null}
		</DrawerListState>
	);
}

const PROJECT_SKELETON_ROWS = [
	"project-one",
	"project-two",
	"project-three",
	"project-four",
	"project-five",
	"project-six",
] as const;

function ProjectListSkeleton({ loadingLabel }: { loadingLabel: string }) {
	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={loadingLabel}
		>
			<AppSkeletonGroup isLoading>
				{PROJECT_SKELETON_ROWS.map((row) => (
					<View key={row} className="flex-row items-center gap-3 py-2">
						<AppSkeletonGroup.Item className="h-[44px] w-[56px] rounded-[10px]" />
						<View className="flex-1 gap-2">
							<AppSkeletonGroup.Item className="h-[14px] w-3/4 rounded-full" />
							<AppSkeletonGroup.Item className="h-3 w-2/5 rounded-full" />
						</View>
					</View>
				))}
			</AppSkeletonGroup>
		</View>
	);
}
