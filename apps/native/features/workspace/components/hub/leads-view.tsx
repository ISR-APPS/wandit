import { useQueryClient } from "@tanstack/react-query";
import {
	GOOGLE_SHEETS_SCOPE,
	type Lead,
	type LeadSource,
	type LeadStatus,
} from "@wandit/contracts";
import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { useDeferredValue, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Linking,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WanditIcon, type WanditIconName } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { authClient } from "@/lib/auth-client";
import { getApiErrorMessage, isApiClientError } from "@/shared/lib/api-client";
import { ICON_STROKE } from "@/shared/lib/brand";
import { AppBottomSheet } from "@/shared/ui/bottom-sheet";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

import { sheetSyncKeys } from "../../api/leads.keys";
import {
	useSyncSheetNow,
	useUpdateLeadArchive,
	useUpdateLeadStatus,
} from "../../api/leads.mutations";
import {
	type LeadListFilters,
	useLeadsInfiniteQuery,
	useSheetSyncQuery,
} from "../../api/leads.queries";
import { listAllLeads } from "../../api/leads.requests";
import { useHubTimeAgo } from "../../lib/hub-time";
import {
	algiersToday,
	formatLeadPhone,
	LEAD_SOURCE,
	LEAD_STATUS,
	LEAD_STATUS_ORDER,
	type LeadDateFilter,
	leadDateRange,
	leadExtrasLine,
	minutesSince,
} from "../../lib/lead-meta";
import { buildLeadsCsv, shareLeadsCsv } from "../../lib/leads-export";
import { SpinnerArc } from "../spinner-arc";
import { HubRoundButton } from "./hub-round-button";

const ACCENT_SOFT = {
	light: "rgba(209,96,34,0.07)",
	dark: "rgba(253,106,58,0.12)",
};
const SKELETON_KEYS = ["a", "b", "c", "d"];

type ArchFilter = LeadListFilters["archived"];
type SheetState =
	| { kind: "source" }
	| { kind: "status" }
	| { kind: "date" }
	| { kind: "arch" }
	| { kind: "lead"; leadId: string }
	| null;

type SheetRow = {
	id: string;
	label: string;
	dot: string | null;
	selected: boolean;
	onPress: () => void;
};

type LeadsViewProps = {
	projectId: string;
	onToast: (message: string) => void;
};

/** Leads section of the project hub, wired to the leads CRM API. */
export function LeadsView({ projectId, onToast }: LeadsViewProps) {
	const { t } = useTranslation();
	const dictionary = useDictionary();
	const { isDark } = useAppTheme();
	const insets = useSafeAreaInsets();
	const queryClient = useQueryClient();
	const accent = useThemeColor("accent");
	const success = useThemeColor("success");
	const danger = useThemeColor("danger");
	const muted = useThemeColor("muted");
	const foreground = useThemeColor("foreground");
	const accentSoft = isDark ? ACCENT_SOFT.dark : ACCENT_SOFT.light;
	const timeAgo = useHubTimeAgo();

	const [search, setSearch] = useState("");
	const [searchFocused, setSearchFocused] = useState(false);
	const [source, setSource] = useState<"all" | LeadSource>("all");
	const [status, setStatus] = useState<"all" | LeadStatus>("all");
	const [date, setDate] = useState<LeadDateFilter>("all");
	const [arch, setArch] = useState<ArchFilter>("exclude");
	const [sheet, setSheet] = useState<SheetState>(null);
	const [exporting, setExporting] = useState(false);
	const [connecting, setConnecting] = useState(false);
	const [syncedJustNow, setSyncedJustNow] = useState(false);

	// Typing filters server-side; the deferred value keeps keystrokes cheap
	// while placeholderData keeps the previous rows on screen.
	const deferredSearch = useDeferredValue(search);
	const filters = useMemo<LeadListFilters>(() => {
		const range = leadDateRange(date);
		const query = deferredSearch.trim().slice(0, 200);
		return {
			archived: arch,
			...(range.createdFrom ? { createdFrom: range.createdFrom } : {}),
			...(range.createdTo ? { createdTo: range.createdTo } : {}),
			...(query ? { q: query } : {}),
			...(source !== "all" ? { source } : {}),
			...(status !== "all" ? { status } : {}),
		};
	}, [arch, date, deferredSearch, source, status]);

	const leadsQuery = useLeadsInfiniteQuery(projectId, filters);
	const pages = leadsQuery.data?.pages ?? [];
	const leads = pages.flatMap((page) => page.leads);
	// Project-wide counts — the server ignores filters for these (chips read
	// the whole book), while `total` is the filtered match count.
	const totals = pages[0]?.totals;
	const filteredTotal = pages.at(-1)?.total ?? leads.length;

	const syncState = useSheetSyncQuery(projectId);
	const syncNow = useSyncSheetNow(projectId);
	const updateStatus = useUpdateLeadStatus(projectId);
	const updateArchive = useUpdateLeadArchive(projectId);

	// A 409 from a sync means the grant is dead even though the account row
	// still claims the scope — the only way out is a fresh consent, so fall
	// back to the Connect button (mirrors the web tab).
	const needsReconnect =
		isApiClientError(syncNow.error) && syncNow.error.statusCode === 409;
	const sheetConnected = syncState.data?.connected === true && !needsReconnect;
	const sheetInfo = syncState.data?.sheet ?? null;

	const rate =
		totals && totals.confirmed + totals.cancelled > 0
			? Math.round(
					(totals.confirmed / (totals.confirmed + totals.cancelled)) * 100,
				)
			: null;

	const isFiltering =
		search.trim().length > 0 ||
		source !== "all" ||
		status !== "all" ||
		date !== "all" ||
		arch !== "exclude";

	function clearFilters() {
		setSearch("");
		setSource("all");
		setStatus("all");
		setDate("all");
		setArch("exclude");
	}

	async function exportCsv() {
		if (exporting) return;
		setExporting(true);
		try {
			const all = await listAllLeads(projectId, filters);
			if (all.length === 0) {
				onToast(t("native.workspace.leadsView.exportEmpty"));
				return;
			}
			const csv = buildLeadsCsv(all, dictionary.leads.csvHeaders, (lead) =>
				t(LEAD_STATUS[lead.status].labelKey),
			);
			await shareLeadsCsv(`wandit-leads-${algiersToday()}.csv`, csv);
			onToast(
				t("native.workspace.leadsView.exportDone", { count: all.length }),
			);
		} catch {
			onToast(t("native.workspace.leadsView.exportError"));
		} finally {
			setExporting(false);
		}
	}

	// The consent screen runs in the system browser (better-auth expo client
	// deep-links back); the state refetch afterwards is what flips the button
	// from "Connect" to "Sync" — native has no focus-refetch to rely on.
	async function connectSheets() {
		if (connecting) return;
		setConnecting(true);
		onToast(t("native.workspace.leadsView.sheets.connectToast"));
		try {
			const { error } = await authClient.linkSocial({
				provider: "google",
				scopes: [GOOGLE_SHEETS_SCOPE],
				callbackURL: "/",
			});
			if (error) {
				onToast(t("leads.sheetSync.errorToast"));
			} else {
				syncNow.reset();
			}
		} catch {
			onToast(t("leads.sheetSync.errorToast"));
		} finally {
			setConnecting(false);
			void queryClient.invalidateQueries({
				queryKey: sheetSyncKeys.state(projectId),
			});
		}
	}

	function syncSheets() {
		if (syncNow.isPending || syncState.isPending) return;
		syncNow.mutate(undefined, {
			onSuccess: (state) => {
				setSyncedJustNow(true);
				onToast(
					t("native.workspace.leadsView.sheets.syncDone", {
						count: state.sheet?.syncedLeadCount ?? 0,
					}),
				);
			},
			onError: (error) => {
				// The server's 409s are actionable ("reconnect Google Sheets…",
				// Google's own refusal text) — show them; anything opaque gets
				// the sheet-specific fallback.
				onToast(
					isApiClientError(error) && error.hasServerEnvelopeMessage
						? getApiErrorMessage(error)
						: t("leads.sheetSync.errorToast"),
				);
			},
		});
	}

	function openSpreadsheet() {
		if (!sheetInfo) return;
		Linking.openURL(sheetInfo.spreadsheetUrl).catch(() => {
			onToast(t("leads.sheetSync.errorToast"));
		});
	}

	function setLeadStatus(leadId: string, next: LeadStatus) {
		setSheet(null);
		const lead = leads.find((candidate) => candidate.id === leadId);
		if (!lead || lead.status === next) return;
		updateStatus.mutate(
			{ leadId, status: next },
			{
				onError: () => onToast(t("native.workspace.leadsView.changeError")),
			},
		);
		onToast(
			t("native.workspace.leadsView.statusChanged", {
				name: lead.name,
				status: t(LEAD_STATUS[next].labelKey),
			}),
		);
	}

	function toggleArchive(lead: Lead) {
		setSheet(null);
		const archived = lead.archivedAt === null;
		updateArchive.mutate(
			{ leadId: lead.id, archived },
			{
				onSuccess: () =>
					onToast(
						t(archived ? "leads.archivedToast" : "leads.unarchivedToast", {
							name: lead.name,
						}),
					),
				onError: () => onToast(t("native.workspace.leadsView.changeError")),
			},
		);
	}

	function callLead(lead: Lead) {
		Linking.openURL(`tel:${lead.phone}`).catch(() => {
			onToast(
				`${t("native.workspace.leadsView.callLabel")} — ${formatLeadPhone(lead.phone)}`,
			);
		});
	}

	function whatsappLead(lead: Lead) {
		Linking.openURL(`https://wa.me/${lead.phone.replace(/\D/g, "")}`).catch(
			() => {
				onToast(
					`${t("native.workspace.leadsView.whatsappLabel")} — ${lead.name}`,
				);
			},
		);
	}

	const sourceLabel =
		source === "all"
			? t("native.workspace.leadsView.filters.allSources")
			: t(LEAD_SOURCE[source].labelKey);
	const statusLabel =
		status === "all"
			? t("native.workspace.leadsView.filters.allStatuses")
			: t(LEAD_STATUS[status].labelKey);
	const dateLabel = t(
		date === "all"
			? "native.workspace.leadsView.filters.allDates"
			: date === "today"
				? "native.workspace.leadsView.filters.today"
				: date === "last7"
					? "native.workspace.leadsView.filters.last7"
					: "native.workspace.leadsView.filters.last30",
	);
	const archLabel = t(
		arch === "exclude"
			? "native.workspace.leadsView.filters.active"
			: arch === "only"
				? "native.workspace.leadsView.filters.archived"
				: "native.workspace.leadsView.filters.allLeads",
	);

	const sheetSubtitle = syncState.isPending
		? "…"
		: !sheetConnected
			? t("native.workspace.leadsView.sheets.notConnected")
			: sheetInfo?.lastSyncedAt
				? t("native.workspace.leadsView.sheets.lastSync", {
						time: syncedJustNow
							? t("native.workspace.leadsView.sheets.justNow")
							: timeAgo(minutesSince(sheetInfo.lastSyncedAt)),
					})
				: t("native.workspace.leadsView.sheets.neverSynced");

	function sheetRow(
		id: string,
		label: string,
		dot: string | null,
		selected: boolean,
		apply: () => void,
	): SheetRow {
		return {
			id,
			label,
			dot,
			selected,
			onPress: () => {
				apply();
				setSheet(null);
			},
		};
	}

	function buildSheet(): { title: string; rows: SheetRow[] } | null {
		if (!sheet) return null;
		if (sheet.kind === "source") {
			return {
				title: t("native.workspace.leadsView.sheetTitles.source"),
				rows: [
					sheetRow(
						"all",
						t("native.workspace.leadsView.filters.allSources"),
						null,
						source === "all",
						() => setSource("all"),
					),
					...(["facebook", "tiktok", "direct"] as const).map((key) =>
						sheetRow(
							key,
							t(LEAD_SOURCE[key].labelKey),
							LEAD_SOURCE[key].dot ?? foreground,
							source === key,
							() => setSource(key),
						),
					),
				],
			};
		}
		if (sheet.kind === "status") {
			return {
				title: t("native.workspace.leadsView.sheetTitles.status"),
				rows: [
					sheetRow(
						"all",
						t("native.workspace.leadsView.filters.allStatuses"),
						null,
						status === "all",
						() => setStatus("all"),
					),
					...LEAD_STATUS_ORDER.map((key) =>
						sheetRow(
							key,
							t(LEAD_STATUS[key].labelKey),
							LEAD_STATUS[key].dot,
							status === key,
							() => setStatus(key),
						),
					),
				],
			};
		}
		if (sheet.kind === "date") {
			const options: { key: LeadDateFilter; label: string }[] = [
				{ key: "all", label: t("native.workspace.leadsView.filters.allDates") },
				{ key: "today", label: t("native.workspace.leadsView.filters.today") },
				{ key: "last7", label: t("native.workspace.leadsView.filters.last7") },
				{
					key: "last30",
					label: t("native.workspace.leadsView.filters.last30"),
				},
			];
			return {
				title: t("native.workspace.leadsView.sheetTitles.date"),
				rows: options.map((option) =>
					sheetRow(option.key, option.label, null, date === option.key, () =>
						setDate(option.key),
					),
				),
			};
		}
		if (sheet.kind === "arch") {
			const options: { key: ArchFilter; label: string }[] = [
				{
					key: "exclude",
					label: t("native.workspace.leadsView.filters.active"),
				},
				{
					key: "only",
					label: t("native.workspace.leadsView.filters.archived"),
				},
				{
					key: "include",
					label: t("native.workspace.leadsView.filters.allLeads"),
				},
			];
			return {
				title: t("native.workspace.leadsView.sheetTitles.visibility"),
				rows: options.map((option) =>
					sheetRow(option.key, option.label, null, arch === option.key, () =>
						setArch(option.key),
					),
				),
			};
		}
		const lead = leads.find((candidate) => candidate.id === sheet.leadId);
		return {
			title: t("native.workspace.leadsView.sheetTitles.leadStatus"),
			rows: [
				...LEAD_STATUS_ORDER.map((key) => ({
					id: key,
					label: t(LEAD_STATUS[key].labelKey),
					dot: LEAD_STATUS[key].dot,
					selected: lead?.status === key,
					onPress: () => setLeadStatus(sheet.leadId, key),
				})),
				// The pipeline's exit door rides along under the statuses.
				{
					id: "archive",
					label: t(lead?.archivedAt ? "leads.unarchive" : "leads.archive"),
					dot: null,
					selected: false,
					onPress: () => {
						if (lead) toggleArchive(lead);
					},
				},
			],
		};
	}

	const sheetContent = buildSheet();
	const listEmpty =
		!leadsQuery.isPending && !leadsQuery.isError && leads.length === 0;
	const showNoResults = listEmpty && isFiltering;
	const showEmptyBook = listEmpty && !isFiltering;

	return (
		<>
			<ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 15,
					paddingTop: 2,
					paddingBottom: insets.bottom + 118,
				}}
			>
				{/* Title row */}
				<View className="flex-row items-center gap-2">
					<View className="min-w-0 flex-1">
						<Text className="font-sans-semibold text-[23px] text-foreground leading-[26px]">
							{t("native.workspace.dock.leads")}
						</Text>
						<Text className="mt-[3px] text-[12.5px] text-muted">
							{t("native.workspace.leadsView.subtitle")}
						</Text>
					</View>
					<HubRoundButton
						icon="download"
						label={t("native.workspace.leadsView.exportLabel")}
						onPress={() => void exportCsv()}
						spinning={exporting}
					/>
				</View>

				{/* Stat chips — whole-book counts, filters ignored (design §7). */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					className="mt-3.5"
					contentContainerStyle={{ gap: 8, padding: 1 }}
				>
					<StatChip
						label={t("native.workspace.leadsView.statToday")}
						value={totals ? String(totals.today) : "—"}
					/>
					<StatChip
						label={t("native.workspace.leadsView.statWeek")}
						value={totals ? String(totals.last7Days) : "—"}
					/>
					<StatChip
						label={t("native.workspace.leadsView.statTotal")}
						value={totals ? String(totals.total) : "—"}
					/>
					<View className="min-w-[128px] rounded-[14px] border border-border bg-surface px-[13px] py-2.5 dark:bg-surface-secondary">
						<Text numberOfLines={1} className="text-[11.5px] text-muted">
							{t("native.workspace.leadsView.statRate")}
						</Text>
						<View className="mt-0.5 flex-row items-center gap-2">
							<Text
								className="font-mono-medium text-[20px] text-foreground"
								style={{ fontVariant: ["tabular-nums"] }}
							>
								{rate === null ? "—" : `${rate}%`}
							</Text>
							<View className="h-1 min-w-[34px] flex-1 overflow-hidden rounded-full bg-surface-tertiary">
								<View
									className="h-full overflow-hidden rounded-full"
									style={{ width: `${rate ?? 0}%` }}
								>
									<BrandGradientFill radius={2} />
								</View>
							</View>
						</View>
					</View>
				</ScrollView>

				{/* Google Sheets sync */}
				<View className="mt-2.5 flex-row items-center gap-2.5 rounded-[14px] border border-border bg-surface-secondary p-[9px] ps-[13px]">
					<WanditIcon name="spreadsheet" size={16} color={success} />
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("native.workspace.leadsView.sheets.open")}
						className="min-w-0 flex-1"
						disabled={sheetInfo === null}
						onPress={openSpreadsheet}
					>
						<Text className="font-sans-medium text-[13px] text-foreground">
							{t("native.workspace.leadsView.sheets.title")}
						</Text>
						<Text numberOfLines={1} className="mt-px text-[11.5px] text-muted">
							{sheetSubtitle}
						</Text>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ busy: syncNow.isPending || connecting }}
						disabled={syncState.isPending || syncNow.isPending || connecting}
						onPress={sheetConnected ? syncSheets : () => void connectSheets()}
						className="h-[34px] flex-row items-center gap-[7px] rounded-full bg-accent px-[13px] active:scale-[0.96]"
					>
						{syncNow.isPending || connecting ? <SpinnerArc size={12} /> : null}
						<Text className="font-sans-medium text-[12.5px] text-accent-foreground">
							{!sheetConnected && !syncState.isPending
								? t("native.workspace.leadsView.sheets.connect")
								: syncNow.isPending
									? t("native.workspace.leadsView.sheets.syncing")
									: t("native.workspace.leadsView.sheets.sync")}
						</Text>
					</Pressable>
				</View>

				{/* Search */}
				<View
					className={`mt-3.5 h-[46px] flex-row items-center gap-2.5 rounded-full border bg-surface ps-4 pe-4 dark:bg-surface-secondary ${
						searchFocused ? "border-accent" : "border-border"
					}`}
					style={
						searchFocused ? { boxShadow: `0 0 0 3px ${accentSoft}` } : undefined
					}
				>
					<View className="opacity-50">
						<WanditIcon name="search" size={16} color={foreground} />
					</View>
					<TextInput
						value={search}
						onChangeText={setSearch}
						onFocus={() => setSearchFocused(true)}
						onBlur={() => setSearchFocused(false)}
						placeholder={t("native.workspace.leadsView.searchPlaceholder")}
						placeholderTextColor={muted}
						autoCapitalize="none"
						autoCorrect={false}
						className="min-w-0 flex-1 text-[15px] text-foreground"
					/>
				</View>

				{/* Filter pills */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					className="mt-2.5"
					contentContainerStyle={{
						gap: 8,
						paddingVertical: 2,
						paddingHorizontal: 1,
					}}
				>
					<FilterPill
						label={sourceLabel}
						active={source !== "all"}
						accent={accent}
						accentSoft={accentSoft}
						foreground={foreground}
						onPress={() => setSheet({ kind: "source" })}
					/>
					<FilterPill
						label={statusLabel}
						active={status !== "all"}
						accent={accent}
						accentSoft={accentSoft}
						foreground={foreground}
						onPress={() => setSheet({ kind: "status" })}
					/>
					<FilterPill
						label={dateLabel}
						active={date !== "all"}
						accent={accent}
						accentSoft={accentSoft}
						foreground={foreground}
						onPress={() => setSheet({ kind: "date" })}
					/>
					<FilterPill
						label={archLabel}
						active={arch !== "exclude"}
						accent={accent}
						accentSoft={accentSoft}
						foreground={foreground}
						onPress={() => setSheet({ kind: "arch" })}
					/>
				</ScrollView>

				{/* Lead list */}
				{leadsQuery.isPending ? (
					// Card-shaped placeholders where the list will land.
					<View className="mt-3 gap-2.5">
						{SKELETON_KEYS.map((key) => (
							<View
								key={key}
								className="h-[118px] rounded-[16px] bg-surface-secondary"
							/>
						))}
					</View>
				) : leadsQuery.isError && leads.length === 0 ? (
					<View className="mt-3 rounded-[16px] border border-danger/25 bg-danger/5 p-4">
						<View className="flex-row items-start gap-2.5">
							<WanditIcon name="alertTriangle" size={15} color={danger} />
							<View className="min-w-0 flex-1">
								<Text className="font-sans-medium text-[13.5px] text-foreground">
									{t("leads.loadError")}
								</Text>
								<Pressable
									accessibilityRole="button"
									onPress={() => void leadsQuery.refetch()}
									disabled={leadsQuery.isFetching}
									className="mt-2.5 h-[32px] flex-row items-center gap-1.5 self-start rounded-full border border-border px-3 active:scale-95"
								>
									{leadsQuery.isFetching ? (
										<ActivityIndicator size="small" color={muted} />
									) : (
										<WanditIcon name="refresh" size={12} color={muted} />
									)}
									<Text className="font-sans-semibold text-[12px] text-foreground">
										{t("leads.retry")}
									</Text>
								</Pressable>
							</View>
						</View>
					</View>
				) : (
					<View className="mt-3 gap-2.5">
						{leads.map((lead) => (
							<LeadCard
								key={lead.id}
								lead={lead}
								timeLabel={timeAgo(minutesSince(lead.createdAt))}
								onStatusPress={() =>
									setSheet({ kind: "lead", leadId: lead.id })
								}
								onCall={() => callLead(lead)}
								onWhatsapp={() => whatsappLead(lead)}
							/>
						))}

						{showNoResults ? (
							<EmptyPanel
								icon="searchX"
								title={t("native.workspace.leadsView.noResultsTitle")}
								body={t("native.workspace.leadsView.noResultsBody")}
								cta={t("native.workspace.leadsView.clearFilters")}
								onCta={clearFilters}
								mutedColor={muted}
							/>
						) : null}
						{showEmptyBook ? (
							<EmptyPanel
								icon="users"
								title={t("native.workspace.leadsView.emptyTitle")}
								body={t("native.workspace.leadsView.emptyBody")}
								cta={t("native.workspace.leadsView.emptyCta")}
								onCta={() =>
									onToast(t("native.workspace.leadsView.emptyCtaToast"))
								}
								mutedColor={muted}
							/>
						) : null}
					</View>
				)}

				{leadsQuery.hasNextPage ? (
					<Pressable
						accessibilityRole="button"
						onPress={() => {
							if (!leadsQuery.isFetchingNextPage) {
								void leadsQuery.fetchNextPage();
							}
						}}
						className="mt-3 h-[38px] flex-row items-center gap-2 self-center rounded-full border border-border bg-surface px-4 active:scale-[0.96] dark:bg-surface-secondary"
					>
						{leadsQuery.isFetchingNextPage ? (
							<ActivityIndicator size="small" color={muted} />
						) : null}
						<Text className="font-sans-medium text-[13.5px] text-foreground">
							{t("native.workspace.leadsView.loadMore")}
						</Text>
					</Pressable>
				) : null}

				{leads.length > 0 ? (
					<Text
						className="mt-3 self-center font-mono text-[11px] text-muted"
						style={{ fontVariant: ["tabular-nums"] }}
					>
						{t("native.workspace.leadsView.pageInfo", {
							count: leads.length,
							total: filteredTotal,
						})}
					</Text>
				) : null}
			</ScrollView>

			{/* Filter / status bottom sheet */}
			<AppBottomSheet
				isOpen={sheet !== null}
				onOpenChange={(open) => {
					if (!open) setSheet(null);
				}}
			>
				<AppBottomSheet.Portal>
					<AppBottomSheet.Overlay />
					<AppBottomSheet.Content
						backgroundClassName="bg-background rounded-t-[26px]"
						handleIndicatorClassName="w-[42px] bg-foreground/15"
						contentContainerClassName="px-[22px] pb-10"
					>
						{sheetContent ? (
							<>
								<Text className="mb-1 font-mono text-[11.5px] text-muted uppercase tracking-[1.8px]">
									{sheetContent.title}
								</Text>
								{sheetContent.rows.map((row) => (
									<Pressable
										key={row.id}
										accessibilityRole="button"
										accessibilityState={{ selected: row.selected }}
										onPress={row.onPress}
										className="flex-row items-center gap-[13px] py-3.5 active:opacity-55"
									>
										{row.dot ? (
											<View
												className="h-2 w-2 rounded-full"
												style={{ backgroundColor: row.dot }}
											/>
										) : null}
										<Text className="flex-1 text-[17px] text-foreground">
											{row.label}
										</Text>
										{row.selected ? (
											<WanditIcon
												name="check"
												size={20}
												color={accent}
												strokeWidth={2.4}
											/>
										) : null}
									</Pressable>
								))}
							</>
						) : null}
					</AppBottomSheet.Content>
				</AppBottomSheet.Portal>
			</AppBottomSheet>
		</>
	);
}

function StatChip({ label, value }: { label: string; value: string }) {
	return (
		<View className="min-w-[104px] rounded-[14px] border border-border bg-surface px-[13px] py-2.5 dark:bg-surface-secondary">
			<Text numberOfLines={1} className="text-[11.5px] text-muted">
				{label}
			</Text>
			<Text
				className="mt-0.5 font-mono-medium text-[20px] text-foreground"
				style={{ fontVariant: ["tabular-nums"] }}
			>
				{value}
			</Text>
		</View>
	);
}

function FilterPill({
	label,
	active,
	accent,
	accentSoft,
	foreground,
	onPress,
}: {
	label: string;
	active: boolean;
	accent: string;
	accentSoft: string;
	foreground: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			className={`h-[38px] flex-row items-center gap-[7px] rounded-full border px-3.5 active:scale-[0.97] ${
				active
					? "border-accent"
					: "border-border bg-surface dark:bg-surface-secondary"
			}`}
			style={active ? { backgroundColor: accentSoft } : undefined}
		>
			<Text
				className="font-sans-medium text-[13.5px]"
				style={{ color: active ? accent : foreground }}
			>
				{label}
			</Text>
			<View className="opacity-55">
				<WanditIcon
					name="caretDown"
					size={12}
					color={active ? accent : foreground}
					strokeWidth={2.2}
				/>
			</View>
		</Pressable>
	);
}

function LeadCard({
	lead,
	timeLabel,
	onStatusPress,
	onCall,
	onWhatsapp,
}: {
	lead: Lead;
	timeLabel: string;
	onStatusPress: () => void;
	onCall: () => void;
	onWhatsapp: () => void;
}) {
	const { t } = useTranslation();
	const { isDark } = useAppTheme();
	const success = useThemeColor("success");
	const foreground = useThemeColor("foreground");
	const iconStroke = isDark ? ICON_STROKE.dark : ICON_STROKE.light;
	const statusStyle = LEAD_STATUS[lead.status];
	const sourceStyle = LEAD_SOURCE[lead.source];
	const statusText = isDark ? statusStyle.textDark : statusStyle.text;
	const extrasLine = leadExtrasLine(lead);
	const metaParts = [
		...(lead.wilaya ? [lead.wilaya] : []),
		...(lead.commune ? [lead.commune] : []),
		...(lead.campaign ? [lead.campaign] : []),
		...(lead.archivedAt !== null
			? [t("native.workspace.leadsView.archivedTag")]
			: []),
	];

	return (
		<View className="rounded-[16px] border border-border bg-surface px-3.5 pt-[13px] pb-[11px] dark:bg-surface-secondary">
			<View className="flex-row items-baseline gap-2.5">
				<Text
					numberOfLines={1}
					className="min-w-0 flex-1 font-sans-semibold text-[15.5px] text-foreground"
				>
					{lead.name}
				</Text>
				<Text className="font-mono text-[11px] text-muted">{timeLabel}</Text>
			</View>
			<View className="mt-[5px] flex-row items-center gap-2">
				<Text className="font-mono text-[13px] text-foreground/80">
					{formatLeadPhone(lead.phone)}
				</Text>
				{metaParts.length > 0 ? (
					<Text
						numberOfLines={1}
						className="min-w-0 flex-1 text-[12.5px] text-muted"
					>
						{`· ${metaParts.join(" · ")}`}
					</Text>
				) : null}
			</View>
			{extrasLine ? (
				<Text className="mt-[7px] text-[12.5px] text-muted">{extrasLine}</Text>
			) : null}
			<View className="mt-[11px] flex-row items-center gap-2 border-separator border-t pt-[11px]">
				<Pressable
					accessibilityRole="button"
					onPress={onStatusPress}
					className="h-[26px] flex-row items-center gap-1.5 rounded-full border px-2.5 active:scale-[0.95]"
					style={{
						backgroundColor: statusStyle.bg,
						borderColor: statusStyle.border,
					}}
				>
					<View
						className="h-1.5 w-1.5 rounded-full"
						style={{ backgroundColor: statusStyle.dot }}
					/>
					<Text
						className="font-sans-medium text-[12px]"
						style={{ color: statusText }}
					>
						{t(statusStyle.labelKey)}
					</Text>
					<View className="opacity-70">
						<WanditIcon
							name="caretDown"
							size={10}
							color={statusText}
							strokeWidth={2.6}
						/>
					</View>
				</Pressable>
				<View className="h-[26px] flex-row items-center gap-1.5 rounded-full border border-border px-[9px]">
					<View
						className="h-[7px] w-[7px] rounded-full"
						style={{ backgroundColor: sourceStyle.dot ?? foreground }}
					/>
					<Text className="text-[11px] text-muted">
						{t(sourceStyle.labelKey)}
					</Text>
				</View>
				<View className="flex-1" />
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("native.workspace.leadsView.callLabel")}
					onPress={onCall}
					className="h-[34px] w-[34px] items-center justify-center rounded-full border border-border bg-background active:scale-90"
				>
					<WanditIcon
						name="phone"
						size={15}
						color={iconStroke}
						strokeWidth={1.7}
					/>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("native.workspace.leadsView.whatsappLabel")}
					onPress={onWhatsapp}
					className="h-[34px] w-[34px] items-center justify-center rounded-full border border-border bg-background active:scale-90"
				>
					<WanditIcon
						name="bubble"
						size={15}
						color={success}
						strokeWidth={1.7}
					/>
				</Pressable>
			</View>
		</View>
	);
}

function EmptyPanel({
	icon,
	title,
	body,
	cta,
	onCta,
	mutedColor,
}: {
	icon: WanditIconName;
	title: string;
	body: string;
	cta: string;
	onCta: () => void;
	mutedColor: string;
}) {
	return (
		<View
			className="items-center gap-1 rounded-[18px] border-[1.5px] border-border px-[22px] py-[30px]"
			style={{ borderStyle: "dashed" }}
		>
			<View className="mb-1.5 h-11 w-11 items-center justify-center rounded-[14px] bg-surface-secondary dark:bg-surface-tertiary">
				<WanditIcon
					name={icon}
					size={20}
					color={mutedColor}
					strokeWidth={1.7}
				/>
			</View>
			<Text className="font-sans-semibold text-[15.5px] text-foreground">
				{title}
			</Text>
			<Text className="text-center text-[13px] text-muted leading-5">
				{body}
			</Text>
			<Pressable
				accessibilityRole="button"
				onPress={onCta}
				className="mt-3 h-[38px] items-center justify-center rounded-full border border-border bg-surface px-4 active:scale-[0.96] dark:bg-surface-secondary"
			>
				<Text className="font-sans-medium text-[13.5px] text-foreground">
					{cta}
				</Text>
			</Pressable>
		</View>
	);
}
