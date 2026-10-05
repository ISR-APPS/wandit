/**
 * Dashboard Leads page at `/leads`: every lead that the V1 pages of the active
 * workspace captured, in one table with search, filters, and keyset pages.
 * A V1 notice at the top tells that the page goes away soon and exports every
 * lead to CSV. The route file imports it by path. Rows reuse the lead parts of
 * the workspace feature (status pill, source badge, contact links, order details).
 */

import { ArchiveIcon } from "@phosphor-icons/react/Archive";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/ArrowCounterClockwise";
import { CaretLeftIcon } from "@phosphor-icons/react/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { ClockCountdownIcon } from "@phosphor-icons/react/ClockCountdown";
import { DotsThreeIcon } from "@phosphor-icons/react/DotsThree";
import { DownloadSimpleIcon } from "@phosphor-icons/react/DownloadSimple";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/MagnifyingGlass";
import { TrayIcon } from "@phosphor-icons/react/Tray";
import { WarningIcon } from "@phosphor-icons/react/Warning";
import { XIcon } from "@phosphor-icons/react/X";
import { Link } from "@tanstack/react-router";
import {
	buildLeadsCsv,
	type LeadStatus,
	type WorkspaceLead,
	type WorkspaceLeadsQuery,
} from "@wandit/contracts";
import { Sentry } from "@wandit/observability/browser";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Input } from "@wandit/ui/components/input";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { cn } from "@wandit/ui/lib/utils";
import { useDeferredValue, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { KeycapButton } from "@/features/landing";
import { useProjectsQuery } from "@/features/projects/api/projects.queries";
import { DashboardShell } from "@/features/projects/components/shell/dashboard-shell";
import {
	downloadTextFile,
	getLeadDateRange,
	LeadSourceBadge,
} from "@/features/workspace";
import { ContactLinks } from "@/features/workspace/components/leads/contact-links";
import { LeadOrderDetails } from "@/features/workspace/components/leads/lead-order-details";
import {
	LeadSkuCell,
	LeadSkuMobileMeta,
} from "@/features/workspace/components/leads/lead-sku-cell";
import { LeadStatusPill } from "@/features/workspace/components/leads/lead-status-select";
import { formatPhone } from "@/features/workspace/lib/helpers";
import { useActiveWorkspaceId } from "@/features/workspaces/lib/workspace-provider";
import { formatDate, useDictionary, useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import {
	useUpdateWorkspaceLeadArchive,
	useUpdateWorkspaceLeadStatus,
} from "../api/workspace-leads.mutations";
import { useWorkspaceLeadsQuery } from "../api/workspace-leads.queries";
import { listAllWorkspaceLeads } from "../api/workspace-leads.services";
import {
	isLeadFilterOn,
	LeadFilterBar,
	type LeadFilterValues,
	NO_LEAD_FILTERS,
} from "../components/lead-filter-bar";

const PAGE_SIZE = 20;
const ROW_SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

// Arabic letters join, so letter spacing would break the words: RTL drops it.
const TABLE_HEAD_CLASS =
	"h-11 font-grotesk font-semibold text-[11px] text-night/60 uppercase tracking-[0.08em] rtl:tracking-normal dark:text-foreground/60";

// group/row: ContactLinks shows the call and WhatsApp links on the hover of the row.
const TABLE_ROW_CLASS =
	"group/row border-night/[0.06] hover:bg-night/[0.025] dark:border-white/[0.06] dark:hover:bg-white/[0.03]";

const ICON_BUTTON_CLASS =
	"rounded-full text-night/70 hover:bg-night/[0.06] hover:text-night dark:text-foreground/70 dark:hover:bg-white/[0.06]";

/** File name of the CSV export, with the local calendar day: "leads-2026-10-05.csv". */
function exportFileName(now: Date): string {
	// getMonth counts from 0, so January is 0.
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `leads-${now.getFullYear()}-${month}-${day}.csv`;
}

function WorkspaceLeadStatus({ lead }: { lead: WorkspaceLead }) {
	const { t } = useTranslation();
	const updateStatus = useUpdateWorkspaceLeadStatus();

	const handleChange = (status: LeadStatus) => {
		if (status === lead.status) return;
		updateStatus.mutate({
			leadId: lead.id,
			projectId: lead.projectId,
			status,
		});
		toast.success(
			t("leads.statusUpdated", {
				name: lead.name,
				status: t(`leads.status.${status}`),
			}),
		);
	};

	return <LeadStatusPill value={lead.status} onChange={handleChange} />;
}

function WorkspaceLeadActions({
	archiveVisibility,
	lead,
	onArchiveChange,
	pending,
}: {
	archiveVisibility: WorkspaceLeadsQuery["archived"];
	lead: WorkspaceLead;
	onArchiveChange: (lead: WorkspaceLead, archived: boolean) => void;
	pending: boolean;
}) {
	const { t } = useTranslation();
	const shouldArchive =
		archiveVisibility === "only"
			? false
			: archiveVisibility === "exclude" || lead.archivedAt === null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className={cn("size-7", ICON_BUTTON_CLASS)}
					aria-label={t("leads.colActions")}
					disabled={pending}
				>
					<DotsThreeIcon aria-hidden weight="bold" className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onSelect={() => onArchiveChange(lead, shouldArchive)}>
					{shouldArchive ? (
						<ArchiveIcon aria-hidden weight="duotone" />
					) : (
						<ArrowCounterClockwiseIcon aria-hidden weight="duotone" />
					)}
					{t(shouldArchive ? "leads.archive" : "leads.unarchive")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Round initial of a lead name. A name with no visible character shows "?". */
function LeadInitial({ name }: { name: string }) {
	// Array.from splits by code point, not by UTF-16 unit, so a letter outside the basic plane stays whole.
	const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?";
	return (
		<span
			aria-hidden
			className="grid size-8 shrink-0 place-items-center rounded-full bg-spark/25 font-grotesk font-semibold text-night text-xs dark:bg-spark/20 dark:text-spark"
		>
			{initial}
		</span>
	);
}

function ProjectLink({ lead }: { lead: WorkspaceLead }) {
	return (
		<Link
			to="/p/$projectId"
			params={{ projectId: lead.projectId }}
			title={lead.projectName}
			className="inline-flex h-6 max-w-40 items-center rounded-full bg-night/[0.06] px-2.5 font-grotesk font-semibold text-[11px] text-night/70 outline-offset-2 transition-colors hover:bg-night/[0.1] hover:text-night focus-visible:outline-2 focus-visible:outline-ember dark:bg-white/[0.08] dark:text-foreground/70 dark:hover:bg-white/[0.12] dark:hover:text-foreground"
		>
			<span dir="auto" className="truncate">
				{lead.projectName}
			</span>
		</Link>
	);
}

/**
 * The night panel at the top of the page. Only V1 pages collect leads, and
 * the page goes away soon, so the panel exports every lead of the workspace.
 */
function V1LeadsNotice({
	isExporting,
	onExport,
}: {
	/** True while the export reads every page of leads from the API. */
	isExporting: boolean;
	onExport: () => void;
}) {
	const { t } = useTranslation();
	const titleId = useId();

	return (
		<section
			aria-labelledby={titleId}
			className="mt-6 flex flex-col gap-4 rounded-[1.5rem] bg-night p-4 text-paper sm:flex-row sm:items-center sm:p-5 dark:bg-card dark:text-foreground dark:ring-1 dark:ring-white/10"
		>
			<div className="flex min-w-0 flex-1 items-start gap-3.5">
				<span
					aria-hidden
					className="grid size-10 shrink-0 place-items-center rounded-xl bg-spark text-night"
				>
					<ClockCountdownIcon weight="fill" className="size-5" />
				</span>
				<div className="min-w-0">
					<h2
						id={titleId}
						className="font-grotesk font-semibold text-[15px] tracking-[-0.01em]"
					>
						{t("leads.v1Notice.title")}
					</h2>
					<p className="mt-1 text-paper/70 text-sm dark:text-foreground/70">
						{t("leads.v1Notice.body")}
					</p>
				</div>
			</div>
			{/* The key keeps its white focus outline: it shows on the night and the dark card ground. */}
			<KeycapButton
				size="md"
				type="button"
				onClick={onExport}
				disabled={isExporting}
				className="w-full sm:w-auto"
			>
				{isExporting ? (
					<CircleNotchIcon
						aria-hidden
						weight="bold"
						className="size-4 animate-spin motion-reduce:animate-none"
					/>
				) : (
					<DownloadSimpleIcon aria-hidden weight="bold" className="size-4" />
				)}
				{t("leads.v1Notice.exportAll")}
			</KeycapButton>
		</section>
	);
}

function LeadsPageSkeleton() {
	return (
		<div className="mt-5">
			<div className="flex flex-wrap items-center gap-2">
				<Skeleton className="h-10 w-full rounded-full sm:w-64" />
				<Skeleton className="h-10 w-28 rounded-full" />
			</div>
			{/* The same shapes as the loaded page: one table card from md up, separate lead cards on a phone. */}
			<div className="mt-4 hidden space-y-1.5 rounded-[1.5rem] bg-white p-1.5 ring-1 ring-night/[0.08] md:block dark:bg-card dark:ring-white/10">
				{ROW_SKELETON_KEYS.map((key) => (
					<Skeleton key={key} className="h-12 rounded-[1.125rem]" />
				))}
			</div>
			<div className="mt-4 space-y-2.5 md:hidden">
				{ROW_SKELETON_KEYS.slice(0, 4).map((key) => (
					<Skeleton key={key} className="h-32 rounded-[1.5rem]" />
				))}
			</div>
		</div>
	);
}

function LeadsError({
	onRetry,
	retrying,
}: {
	onRetry: () => void;
	retrying: boolean;
}) {
	const { t } = useTranslation();

	return (
		<div className="mt-5 flex flex-col items-center justify-center rounded-[2rem] border-2 border-destructive/25 border-solid bg-destructive/[0.035] px-6 py-14 text-center">
			<span
				aria-hidden
				className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive"
			>
				<WarningIcon weight="duotone" className="size-5" />
			</span>
			<h3 className="mt-4 font-bold font-grotesk text-lg text-night dark:text-foreground">
				{t("leads.loadError")}
			</h3>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="mt-4 rounded-full font-grotesk"
				disabled={retrying}
				onClick={onRetry}
			>
				<ArrowClockwiseIcon
					aria-hidden
					weight="bold"
					className={cn(
						"size-3.5",
						retrying && "animate-spin motion-reduce:animate-none",
					)}
				/>
				{t("leads.retry")}
			</Button>
		</div>
	);
}

/**
 * The workspace has no lead. Same dashed frame and night app tile as the dashboard.
 * No call to action: only V1 pages collect leads, and a new project is a V2 app.
 */
function LeadsEmptyState() {
	const { t } = useTranslation();

	return (
		<div className="mt-4 flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-16 text-center dark:border-white/15">
			<span
				aria-hidden
				className="grid size-16 -rotate-6 place-items-center rounded-[28%] bg-night shadow-[0_12px_22px_-12px_rgb(11_16_51/0.55)] dark:ring-1 dark:ring-white/10"
			>
				<TrayIcon weight="duotone" className="size-7 text-spark" />
			</span>
			<h3 className="mt-6 font-bold font-grotesk text-2xl text-night tracking-[-0.03em] dark:text-foreground">
				{t("leads.dashEmptyTitle")}
			</h3>
			<p className="mt-2 max-w-xs text-night/60 text-sm dark:text-foreground/60">
				{t("leads.dashEmptyBody")}
			</p>
		</div>
	);
}

/** The filters hide every lead. Same dashed frame as the empty state, smaller. */
function LeadsNoResults({ onClear }: { onClear: () => void }) {
	const { t } = useTranslation();

	return (
		<div className="mt-4 flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-14 text-center dark:border-white/15">
			<span
				aria-hidden
				className="grid size-12 place-items-center rounded-full bg-white text-night/70 shadow-[0_1px_0_rgb(11_16_51/0.1)] dark:bg-white/10 dark:text-foreground/70"
			>
				<MagnifyingGlassIcon weight="duotone" className="size-5" />
			</span>
			<h3 className="mt-4 font-bold font-grotesk text-lg text-night dark:text-foreground">
				{t("leads.noResultsTitle")}
			</h3>
			<p className="mt-1 max-w-xs text-night/60 text-sm dark:text-foreground/60">
				{t("leads.noResultsBodyFilters")}
			</p>
			<Button
				variant="outline"
				size="sm"
				onClick={onClear}
				className="mt-4 rounded-full font-grotesk"
			>
				{t("leads.clearFilters")}
			</Button>
		</div>
	);
}

export default function WorkspaceLeadsPage() {
	// Keyed by the active workspace so a switch remounts the whole page:
	// filters, cursor history and the query observer's previous data all
	// belong to the old scope and must not survive into the new one.
	const activeWorkspaceId = useActiveWorkspaceId();

	return (
		<DashboardShell titleKey="leads.title">
			<WorkspaceLeadsContent key={activeWorkspaceId ?? "personal"} />
		</DashboardShell>
	);
}

function WorkspaceLeadsContent() {
	const { t, locale } = useTranslation();
	const dictionary = useDictionary();
	const projectsQuery = useProjectsQuery();
	const updateArchive = useUpdateWorkspaceLeadArchive();

	const [search, setSearch] = useState("");
	// "Clear filters" hides itself, so the focus goes to the search field.
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [filters, setFilters] = useState<LeadFilterValues>(NO_LEAD_FILTERS);
	const [cursorHistory, setCursorHistory] = useState<string[]>([]);
	const [isExporting, setIsExporting] = useState(false);
	const deferredSearch = useDeferredValue(search.trim());
	const searchPending = search.trim() !== deferredSearch;
	const cursor = searchPending ? undefined : cursorHistory.at(-1);
	const dateRange = useMemo(
		() => getLeadDateRange(filters.date, filters.pickedDay),
		[filters.date, filters.pickedDay],
	);

	const listQuery = useMemo<WorkspaceLeadsQuery>(
		() => ({
			archived: filters.archived,
			cursor,
			createdFrom: dateRange.createdFrom,
			createdTo: dateRange.createdTo,
			pageSize: PAGE_SIZE,
			projectId: filters.projectId === "all" ? undefined : filters.projectId,
			q: deferredSearch || undefined,
			source: filters.source === "all" ? undefined : filters.source,
			status: filters.status === "all" ? undefined : filters.status,
		}),
		[
			cursor,
			dateRange.createdFrom,
			dateRange.createdTo,
			deferredSearch,
			filters.archived,
			filters.projectId,
			filters.source,
			filters.status,
		],
	);
	const leadsQuery = useWorkspaceLeadsQuery(listQuery);
	const response = leadsQuery.data;
	const leads = response?.leads ?? [];
	const matchingTotal = response?.total ?? 0;
	const currentPage = cursorHistory.length + 1;
	const from = cursorHistory.length * PAGE_SIZE;
	const isFiltering = deferredSearch !== "" || isLeadFilterOn(filters);
	// Only V1 pages capture leads. A V2 app never has one, so it is no filter choice.
	const leadProjects = (projectsQuery.data ?? []).filter(
		(project) => project.engine === "v1_page",
	);
	const resetToFirstPage = () => setCursorHistory([]);

	const handleClearFilters = () => {
		searchInputRef.current?.focus();
		setSearch("");
		setFilters(NO_LEAD_FILTERS);
		setCursorHistory([]);
	};

	const handleArchiveChange = (lead: WorkspaceLead, archived: boolean) => {
		updateArchive.mutate(
			{
				archived,
				leadId: lead.id,
				projectId: lead.projectId,
			},
			{
				onSuccess: () =>
					toast.success(
						t(archived ? "leads.archivedToast" : "leads.unarchivedToast", {
							name: lead.name,
						}),
					),
			},
		);
	};

	const handleExportAll = async () => {
		if (isExporting) return;
		setIsExporting(true);
		try {
			// The export ignores the filters on screen: it keeps every lead, archived ones too.
			const exportLeads = await listAllWorkspaceLeads({ archived: "include" });
			downloadTextFile(
				exportFileName(new Date()),
				buildLeadsCsv(
					exportLeads,
					dictionary.leads.csvHeaders,
					dictionary.leads.csvOrderHeaders,
					(lead) => t(`leads.status.${lead.status}`),
					{
						header: t("leads.colProject"),
						cell: (lead) => lead.projectName,
					},
				),
			);
			toast.success(t("leads.exportedToast", { count: exportLeads.length }));
		} catch (error) {
			// The toast tells the user to try again; the report keeps the cause.
			Sentry.captureException(error, { tags: { source: "leads-export" } });
			toast.error(t("leads.v1Notice.exportError"));
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<div className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6">
			<V1LeadsNotice
				isExporting={isExporting}
				onExport={() => void handleExportAll()}
			/>

			<div className="mt-8 flex flex-wrap items-end gap-x-4 gap-y-2">
				<div className="min-w-0">
					<div className="flex items-center gap-2.5">
						<h2 className="font-bold font-grotesk text-[1.75rem] text-night tracking-[-0.035em] dark:text-foreground">
							{t("leads.title")}
						</h2>
						{response ? (
							<span className="rounded-full bg-night/[0.06] px-2 py-0.5 font-grotesk font-semibold text-night/60 text-xs tabular-nums dark:bg-white/[0.08] dark:text-foreground/60">
								{matchingTotal}
							</span>
						) : null}
					</div>
					<p className="mt-1 text-night/60 text-sm dark:text-foreground/60">
						{t("leads.subtitle")}
					</p>
				</div>
				{response ? (
					<span className="ms-auto text-night/60 text-sm tabular-nums dark:text-foreground/60">
						{t("leads.pageInfo", {
							from: matchingTotal === 0 ? 0 : from + 1,
							to: Math.min(from + leads.length, matchingTotal),
							total: matchingTotal,
						})}
					</span>
				) : null}
			</div>

			{leadsQuery.isPending ? (
				<LeadsPageSkeleton />
			) : leadsQuery.isError && !response ? (
				// A failed request must never read as "you have no leads" — show
				// the error with a retry instead of the onboarding empty state.
				<LeadsError
					onRetry={() => void leadsQuery.refetch()}
					retrying={leadsQuery.isFetching}
				/>
			) : (
				<>
					{/* Toolbar: the search field, the Filters button, and one chip per active filter. */}
					<div className="mt-5 flex flex-wrap items-center gap-2">
						{/* On a phone the search takes the full row, so the filters do not cut its placeholder. */}
						<div className="relative w-full sm:w-64">
							<MagnifyingGlassIcon
								aria-hidden
								weight="bold"
								className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-night/45 dark:text-foreground/50"
							/>
							<Input
								ref={searchInputRef}
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									resetToFirstPage();
								}}
								placeholder={t("leads.searchPlaceholder")}
								aria-label={t("leads.searchPlaceholder")}
								className="h-10 rounded-full border-night/10 bg-white ps-10 text-sm dark:border-border dark:bg-card"
							/>
						</div>
						<LeadFilterBar
							filters={filters}
							projects={leadProjects}
							onChange={(next) => {
								setFilters(next);
								resetToFirstPage();
							}}
						/>
						{isFiltering ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={handleClearFilters}
								className={cn("h-9 font-grotesk", ICON_BUTTON_CLASS)}
							>
								<XIcon aria-hidden weight="bold" className="size-3.5" />
								{t("leads.clearFilters")}
							</Button>
						) : null}
					</div>

					{matchingTotal === 0 && !isFiltering ? (
						<LeadsEmptyState />
					) : matchingTotal === 0 ? (
						<LeadsNoResults onClear={handleClearFilters} />
					) : (
						<>
							{/* While a filter change loads, the old rows stay and dim. */}
							<div
								aria-busy={leadsQuery.isPlaceholderData}
								className={cn(
									"mt-4 transition-opacity duration-200 motion-reduce:transition-none",
									leadsQuery.isPlaceholderData && "opacity-60",
								)}
							>
								{/* Desktop: table */}
								<div className="hidden overflow-hidden rounded-[1.5rem] bg-white shadow-[0_2px_0_rgb(11_16_51/0.06)] ring-1 ring-night/[0.08] md:block dark:bg-card dark:ring-white/10">
									<Table>
										<TableHeader>
											<TableRow className="border-night/[0.06] hover:bg-transparent dark:border-white/[0.06]">
												<TableHead className={cn(TABLE_HEAD_CLASS, "ps-4")}>
													{t("leads.colName")}
												</TableHead>
												<TableHead className={TABLE_HEAD_CLASS}>
													{t("leads.colPhone")}
												</TableHead>
												<TableHead className={TABLE_HEAD_CLASS}>
													{t("leads.colProject")}
												</TableHead>
												<TableHead className={TABLE_HEAD_CLASS}>
													{t("leads.colSource")}
												</TableHead>
												<TableHead className={TABLE_HEAD_CLASS}>
													{t("leads.colDate")}
												</TableHead>
												<TableHead className={TABLE_HEAD_CLASS}>
													{t("leads.colSku")}
												</TableHead>
												<TableHead className={cn(TABLE_HEAD_CLASS, "text-end")}>
													{t("leads.colStatus")}
												</TableHead>
												<TableHead className="w-10 pe-4 text-end">
													<span className="sr-only">
														{t("leads.colActions")}
													</span>
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{leads.map((lead) => (
												<TableRow key={lead.id} className={TABLE_ROW_CLASS}>
													<TableCell className="ps-4">
														<div className="flex items-center gap-3">
															<LeadInitial name={lead.name} />
															<div className="min-w-0">
																<div
																	dir="auto"
																	className="w-fit max-w-52 truncate font-grotesk font-semibold text-night text-sm dark:text-foreground"
																>
																	{lead.name}
																</div>
																<LeadOrderDetails
																	extras={lead.extras}
																	totalLabel={t("leads.orderTotal")}
																/>
															</div>
														</div>
													</TableCell>
													<TableCell>
														<div className="flex items-center gap-1">
															<span
																dir="ltr"
																className="font-mono text-night/80 text-xs dark:text-foreground/80"
															>
																{formatPhone(lead.phone)}
															</span>
															<ContactLinks phone={lead.phone} reveal />
														</div>
													</TableCell>
													<TableCell>
														<ProjectLink lead={lead} />
													</TableCell>
													<TableCell>
														<LeadSourceBadge
															campaign={lead.campaign}
															source={lead.source}
														/>
													</TableCell>
													<TableCell
														className="text-night/60 text-xs tabular-nums dark:text-foreground/60"
														title={formatDate(lead.createdAt, locale, {
															dateStyle: "medium",
															timeStyle: "short",
														})}
													>
														{relativeTime(lead.createdAt)}
													</TableCell>
													<TableCell>
														<LeadSkuCell productSku={lead.productSku} />
													</TableCell>
													<TableCell>
														<div className="flex justify-end">
															<WorkspaceLeadStatus lead={lead} />
														</div>
													</TableCell>
													<TableCell className="pe-4">
														<div className="flex justify-end">
															<WorkspaceLeadActions
																archiveVisibility={filters.archived}
																lead={lead}
																onArchiveChange={handleArchiveChange}
																pending={
																	updateArchive.isPending &&
																	updateArchive.variables?.leadId === lead.id
																}
															/>
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>

								{/* Mobile: card list */}
								<div className="space-y-2.5 md:hidden">
									{leads.map((lead) => (
										<div
											key={lead.id}
											className="rounded-[1.5rem] bg-white p-4 shadow-[0_2px_0_rgb(11_16_51/0.06)] ring-1 ring-night/[0.08] dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10"
										>
											<div className="flex items-center gap-3">
												<LeadInitial name={lead.name} />
												<div
													dir="auto"
													className="min-w-0 flex-1 truncate font-grotesk font-semibold text-night text-sm dark:text-foreground"
												>
													{lead.name}
												</div>
												<div className="flex shrink-0 items-center gap-1">
													<WorkspaceLeadStatus lead={lead} />
													<WorkspaceLeadActions
														archiveVisibility={filters.archived}
														lead={lead}
														onArchiveChange={handleArchiveChange}
														pending={
															updateArchive.isPending &&
															updateArchive.variables?.leadId === lead.id
														}
													/>
												</div>
											</div>
											<div className="mt-3 flex items-center justify-between gap-2">
												<span
													dir="ltr"
													className="font-mono text-night/80 text-xs dark:text-foreground/80"
												>
													{formatPhone(lead.phone)}
												</span>
												<ContactLinks phone={lead.phone} />
											</div>
											<div className="mt-2 flex items-center justify-between gap-2">
												<LeadSkuMobileMeta
													afterSku={relativeTime(lead.createdAt)}
													beforeSku={[lead.projectName]}
													productSku={lead.productSku}
													skuLabel={t("leads.colSku")}
												/>
												<LeadSourceBadge
													campaign={lead.campaign}
													source={lead.source}
												/>
											</div>
											<LeadOrderDetails
												extras={lead.extras}
												totalLabel={t("leads.orderTotal")}
											/>
										</div>
									))}
								</div>
							</div>

							{/* Pagination */}
							{cursorHistory.length > 0 || response?.nextCursor ? (
								<div className="mt-4 flex items-center justify-end gap-2">
									<Button
										variant="outline"
										size="sm"
										className="rounded-full font-grotesk"
										disabled={
											currentPage <= 1 ||
											searchPending ||
											leadsQuery.isPlaceholderData
										}
										onClick={() =>
											setCursorHistory((history) => history.slice(0, -1))
										}
									>
										<CaretLeftIcon
											aria-hidden
											weight="bold"
											className="size-3.5 rtl:-scale-x-100"
										/>
										{t("leads.previous")}
									</Button>
									<span className="px-1 font-grotesk font-semibold text-night/60 text-xs tabular-nums dark:text-foreground/60">
										{t("leads.pageNumber", { page: currentPage })}
									</span>
									<Button
										variant="outline"
										size="sm"
										className="rounded-full font-grotesk"
										disabled={
											!response?.nextCursor ||
											searchPending ||
											leadsQuery.isPlaceholderData
										}
										onClick={() => {
											const nextCursor = response?.nextCursor;
											if (nextCursor) {
												setCursorHistory((history) => [...history, nextCursor]);
											}
										}}
									>
										{t("leads.next")}
										<CaretRightIcon
											aria-hidden
											weight="bold"
											className="size-3.5 rtl:-scale-x-100"
										/>
									</Button>
								</div>
							) : null}
						</>
					)}
				</>
			)}
		</div>
	);
}
