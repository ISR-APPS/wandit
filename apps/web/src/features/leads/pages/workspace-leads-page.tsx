// Dashboard Leads page — the aggregate order book: every lead captured by
// every project the active workspace can see, in one searchable, filterable,
// keyset-paginated table. Rows reuse the workspace tab's building blocks
// (source badge, status pill, call/WhatsApp links) plus a Project column
// linking back to the project that captured the order.

import { Link } from "@tanstack/react-router";
import type {
	LeadSource,
	LeadStatus,
	WorkspaceLead,
	WorkspaceLeadsQuery,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
import { Input } from "@wandit/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
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
import {
	AlertTriangle,
	Archive,
	ArchiveRestore,
	MoreHorizontal,
	RefreshCw,
	Search,
	SearchX,
	Users,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import { useProjectsQuery } from "@/features/projects/api/projects.queries";
import { DashboardShell } from "@/features/projects/components/shell/dashboard-shell";
import { SpinnerArc } from "@/features/workspace/components/chat/request-tray/tray-signals";
import { ContactLinks } from "@/features/workspace/components/leads/contact-links";
import { LeadOrderDetails } from "@/features/workspace/components/leads/lead-order-details";
import {
	LeadSourceBadge,
	SOURCE_DOT_CLASS,
} from "@/features/workspace/components/leads/lead-source-badge";
import { LeadStatusPill } from "@/features/workspace/components/leads/lead-status-select";
import {
	LEAD_SOURCES,
	LEAD_STATUS_META,
	LEAD_STATUS_ORDER,
} from "@/features/workspace/lib/constants";
import { formatPhone } from "@/features/workspace/lib/helpers";
import {
	getLeadDateRange,
	type LeadDateFilter,
} from "@/features/workspace/lib/lead-date-filter";
import { useActiveWorkspaceId } from "@/features/workspaces/lib/workspace-provider";
import { formatDate, useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import {
	useUpdateWorkspaceLeadArchive,
	useUpdateWorkspaceLeadStatus,
} from "../api/workspace-leads.mutations";
import { useWorkspaceLeadsQuery } from "../api/workspace-leads.queries";

const PAGE_SIZE = 20;
const ROW_SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

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
					className="size-7 text-muted-foreground"
					aria-label={t("leads.colActions")}
					disabled={pending}
				>
					<MoreHorizontal className="size-4" aria-hidden />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onSelect={() => onArchiveChange(lead, shouldArchive)}>
					{shouldArchive ? (
						<Archive aria-hidden />
					) : (
						<ArchiveRestore aria-hidden />
					)}
					{t(shouldArchive ? "leads.archive" : "leads.unarchive")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function ProjectLink({ lead }: { lead: WorkspaceLead }) {
	return (
		<Link
			to="/p/$projectId"
			params={{ projectId: lead.projectId }}
			className="max-w-40 truncate text-sm underline-offset-2 hover:underline"
			title={lead.projectName}
		>
			{lead.projectName}
		</Link>
	);
}

function LeadsPageSkeleton() {
	return (
		<div className="mt-5 space-y-2">
			<Skeleton className="h-9 w-full max-w-md rounded-xl" />
			{ROW_SKELETON_KEYS.map((key) => (
				<Skeleton key={key} className="h-12 rounded-xl" />
			))}
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
		<div className="mt-5 rounded-xl border border-destructive/25 bg-destructive/[0.035] p-4">
			<div className="flex items-start gap-2.5">
				<span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
					<AlertTriangle className="size-3.5" aria-hidden />
				</span>
				<div className="min-w-0 flex-1">
					<p className="font-medium text-[13.5px] text-foreground">
						{t("leads.loadError")}
					</p>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="-ms-2 mt-1 h-7 px-2 text-muted-foreground text-xs"
						disabled={retrying}
						onClick={onRetry}
					>
						{retrying ? (
							<SpinnerArc className="size-3" />
						) : (
							<RefreshCw className="size-3" aria-hidden />
						)}
						{t("leads.retry")}
					</Button>
				</div>
			</div>
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
	const projectsQuery = useProjectsQuery();
	const updateArchive = useUpdateWorkspaceLeadArchive();

	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
	const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
	const [projectFilter, setProjectFilter] = useState<string>("all");
	const [dateFilter, setDateFilter] = useState<LeadDateFilter>("all");
	const [pickedDay, setPickedDay] = useState("");
	const [archivedFilter, setArchivedFilter] =
		useState<WorkspaceLeadsQuery["archived"]>("exclude");
	const [cursorHistory, setCursorHistory] = useState<string[]>([]);
	const deferredSearch = useDeferredValue(search.trim());
	const searchPending = search.trim() !== deferredSearch;
	const cursor = searchPending ? undefined : cursorHistory.at(-1);
	const dateRange = useMemo(
		() => getLeadDateRange(dateFilter, pickedDay),
		[dateFilter, pickedDay],
	);

	const listQuery = useMemo<WorkspaceLeadsQuery>(
		() => ({
			archived: archivedFilter,
			cursor,
			createdFrom: dateRange.createdFrom,
			createdTo: dateRange.createdTo,
			pageSize: PAGE_SIZE,
			projectId: projectFilter === "all" ? undefined : projectFilter,
			q: deferredSearch || undefined,
			source: sourceFilter === "all" ? undefined : sourceFilter,
			status: statusFilter === "all" ? undefined : statusFilter,
		}),
		[
			archivedFilter,
			cursor,
			dateRange.createdFrom,
			dateRange.createdTo,
			deferredSearch,
			projectFilter,
			sourceFilter,
			statusFilter,
		],
	);
	const leadsQuery = useWorkspaceLeadsQuery(listQuery);
	const response = leadsQuery.data;
	const leads = response?.leads ?? [];
	const matchingTotal = response?.total ?? 0;
	const currentPage = cursorHistory.length + 1;
	const from = cursorHistory.length * PAGE_SIZE;
	const isFiltering =
		deferredSearch !== "" ||
		statusFilter !== "all" ||
		sourceFilter !== "all" ||
		projectFilter !== "all" ||
		dateFilter !== "all" ||
		archivedFilter !== "exclude";

	const resetToFirstPage = () => setCursorHistory([]);

	const handleClearFilters = () => {
		setSearch("");
		setStatusFilter("all");
		setSourceFilter("all");
		setProjectFilter("all");
		setDateFilter("all");
		setPickedDay("");
		setArchivedFilter("exclude");
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

	return (
		<div className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6">
			<div className="mt-8 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="font-display font-semibold text-lg tracking-tight">
						{t("leads.title")}
					</h2>
					<p className="mt-0.5 text-muted-foreground text-xs">
						{t("leads.subtitle")}
					</p>
				</div>
				{response ? (
					<span className="mt-1 font-mono text-muted-foreground text-xs">
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
					{/* Toolbar: search + project / source / status / date filters */}
					<div className="mt-5 flex flex-col gap-2 lg:flex-row lg:items-center">
						<div className="relative w-full lg:max-w-xs">
							<Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									resetToFirstPage();
								}}
								placeholder={t("leads.searchPlaceholder")}
								className="ps-9"
							/>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Select
								value={projectFilter}
								onValueChange={(value) => {
									setProjectFilter(value);
									resetToFirstPage();
								}}
							>
								<SelectTrigger className="w-44">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">{t("leads.allProjects")}</SelectItem>
									{(projectsQuery.data ?? []).map((project) => (
										<SelectItem key={project.id} value={project.id}>
											<span className="max-w-44 truncate">{project.name}</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={sourceFilter}
								onValueChange={(value) => {
									setSourceFilter(value as LeadSource | "all");
									resetToFirstPage();
								}}
							>
								<SelectTrigger className="w-40">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">{t("leads.allSources")}</SelectItem>
									{LEAD_SOURCES.map((source) => (
										<SelectItem key={source} value={source}>
											<span
												aria-hidden
												className={cn(
													"size-1.5 shrink-0 rounded-full",
													SOURCE_DOT_CLASS[source],
												)}
											/>
											{t(`leads.source.${source}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={statusFilter}
								onValueChange={(value) => {
									setStatusFilter(value as LeadStatus | "all");
									resetToFirstPage();
								}}
							>
								<SelectTrigger className="w-40">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">{t("leads.filterAll")}</SelectItem>
									{LEAD_STATUS_ORDER.map((status) => (
										<SelectItem key={status} value={status}>
											<span
												aria-hidden
												className={cn(
													"size-1.5 shrink-0 rounded-full",
													LEAD_STATUS_META[status].dotClass,
												)}
											/>
											{t(`leads.status.${status}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={archivedFilter}
								onValueChange={(value) => {
									setArchivedFilter(value as WorkspaceLeadsQuery["archived"]);
									resetToFirstPage();
								}}
							>
								<SelectTrigger className="w-40">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="exclude">
										{t("leads.filterActive")}
									</SelectItem>
									<SelectItem value="only">
										{t("leads.filterArchived")}
									</SelectItem>
									<SelectItem value="include">
										{t("leads.filterAllLeads")}
									</SelectItem>
								</SelectContent>
							</Select>
							<Select
								value={dateFilter}
								onValueChange={(value) => {
									setDateFilter(value as LeadDateFilter);
									resetToFirstPage();
								}}
							>
								<SelectTrigger className="w-40">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">{t("leads.allDates")}</SelectItem>
									<SelectItem value="today">{t("leads.dateToday")}</SelectItem>
									<SelectItem value="last7Days">
										{t("leads.dateLast7Days")}
									</SelectItem>
									<SelectItem value="last30Days">
										{t("leads.dateLast30Days")}
									</SelectItem>
									<SelectItem value="pickDay">
										{t("leads.datePickDay")}
									</SelectItem>
								</SelectContent>
							</Select>
							{dateFilter === "pickDay" ? (
								<Input
									type="date"
									value={pickedDay}
									onChange={(event) => {
										setPickedDay(event.target.value);
										resetToFirstPage();
									}}
									aria-label={t("leads.datePickDay")}
									className="w-40"
								/>
							) : null}
						</div>
					</div>

					{matchingTotal === 0 && !isFiltering ? (
						<Empty className="mt-4 rounded-xl border border-dashed">
							<EmptyHeader>
								<EmptyMedia variant="icon" className="rounded-xl">
									<Users />
								</EmptyMedia>
								<EmptyTitle className="font-display">
									{t("leads.dashEmptyTitle")}
								</EmptyTitle>
								<EmptyDescription>{t("leads.dashEmptyBody")}</EmptyDescription>
							</EmptyHeader>
							<EmptyContent>
								<Button asChild variant="secondary">
									<Link to="/dashboard">{t("projects.headerTitle")}</Link>
								</Button>
							</EmptyContent>
						</Empty>
					) : matchingTotal === 0 ? (
						<Empty className="mt-4 rounded-xl border border-dashed">
							<EmptyHeader>
								<EmptyMedia variant="icon" className="rounded-xl">
									<SearchX />
								</EmptyMedia>
								<EmptyTitle className="font-display">
									{t("leads.noResultsTitle")}
								</EmptyTitle>
								<EmptyDescription>
									{t("leads.noResultsBodyFilters")}
								</EmptyDescription>
							</EmptyHeader>
							<EmptyContent>
								<Button
									variant="outline"
									size="sm"
									onClick={handleClearFilters}
								>
									{t("leads.clearFilters")}
								</Button>
							</EmptyContent>
						</Empty>
					) : (
						<>
							{/* Desktop: table */}
							<div className="mt-4 hidden overflow-hidden rounded-xl border bg-card md:block">
								<Table>
									<TableHeader>
										<TableRow className="hover:bg-transparent">
											<TableHead className="ps-4">
												{t("leads.colName")}
											</TableHead>
											<TableHead>{t("leads.colPhone")}</TableHead>
											<TableHead>{t("leads.colProject")}</TableHead>
											<TableHead>{t("leads.colSource")}</TableHead>
											<TableHead>{t("leads.colDate")}</TableHead>
											<TableHead className="text-end">
												{t("leads.colStatus")}
											</TableHead>
											<TableHead className="w-10 pe-4 text-end">
												<span className="sr-only">{t("leads.colActions")}</span>
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{leads.map((lead) => (
											<TableRow key={lead.id} className="group/row">
												<TableCell className="ps-4">
													<div
														dir="auto"
														className="max-w-52 truncate font-medium"
													>
														{lead.name}
													</div>
													<LeadOrderDetails
														extras={lead.extras}
														totalLabel={t("leads.orderTotal")}
													/>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-1">
														<span className="font-mono text-xs">
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
													className="font-mono text-muted-foreground text-xs"
													title={formatDate(lead.createdAt, locale, {
														dateStyle: "medium",
														timeStyle: "short",
													})}
												>
													{relativeTime(lead.createdAt)}
												</TableCell>
												<TableCell>
													<div className="flex justify-end">
														<WorkspaceLeadStatus lead={lead} />
													</div>
												</TableCell>
												<TableCell className="pe-4">
													<div className="flex justify-end">
														<WorkspaceLeadActions
															archiveVisibility={archivedFilter}
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
							<div className="mt-4 space-y-2 md:hidden">
								{leads.map((lead) => (
									<div
										key={lead.id}
										className="rounded-xl border bg-card p-3.5"
									>
										<div className="flex items-center justify-between gap-2">
											<div
												dir="auto"
												className="min-w-0 truncate font-medium text-sm"
											>
												{lead.name}
											</div>
											<div className="flex shrink-0 items-center gap-1">
												<WorkspaceLeadStatus lead={lead} />
												<WorkspaceLeadActions
													archiveVisibility={archivedFilter}
													lead={lead}
													onArchiveChange={handleArchiveChange}
													pending={
														updateArchive.isPending &&
														updateArchive.variables?.leadId === lead.id
													}
												/>
											</div>
										</div>
										<div className="mt-2 flex items-center justify-between gap-2">
											<span className="font-mono text-xs">
												{formatPhone(lead.phone)}
											</span>
											<ContactLinks phone={lead.phone} />
										</div>
										<div className="mt-2 flex items-center justify-between gap-2">
											<span className="min-w-0 truncate text-muted-foreground text-xs">
												{[lead.projectName, relativeTime(lead.createdAt)].join(
													" · ",
												)}
											</span>
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

							{/* Pagination */}
							{cursorHistory.length > 0 || response?.nextCursor ? (
								<div className="mt-4 flex items-center justify-end gap-2">
									<Button
										variant="outline"
										size="sm"
										disabled={
											currentPage <= 1 ||
											searchPending ||
											leadsQuery.isPlaceholderData
										}
										onClick={() =>
											setCursorHistory((history) => history.slice(0, -1))
										}
									>
										{t("leads.previous")}
									</Button>
									<Button
										variant="outline"
										size="sm"
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
