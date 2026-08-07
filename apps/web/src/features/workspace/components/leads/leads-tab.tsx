// Leads tab — the mini order-CRM: counters, search + status filter, a
// desktop table / mobile card list with call & WhatsApp shortcuts, inline
// status pipeline and complete CSV export, paginated server-side.

import type { LeadsQuery } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import {
	Download,
	MessageCircle,
	Phone,
	Search,
	SearchX,
	Users,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import { formatDate, useDictionary, useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import type { Lead, LeadStatus } from "../../api/dto";
import { useLeadsQuery } from "../../api/leads.queries";
import { listAllLeads } from "../../api/leads.services";
import {
	LEAD_STATUS_META,
	LEAD_STATUS_ORDER,
	LEADS_PAGE_SIZE,
} from "../../lib/constants";
import {
	buildLeadsCsv,
	downloadTextFile,
	formatPhone,
	telHref,
	waHref,
} from "../../lib/helpers";
import { useWorkspace } from "../../lib/store";
import { LeadOrderDetails } from "./lead-order-details";
import { LeadSourceBadge } from "./lead-source-badge";
import { LeadStatusSelect } from "./lead-status-select";
import { LeadsCounters } from "./leads-counters";
import { SheetSyncButton } from "./sheet-sync-button";

const HOVER_REVEAL =
	"opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover/row:opacity-100";

/** Call + WhatsApp icon links for one lead; `reveal` hides them until the
 * table row is hovered (or a link is keyboard-focused). */
function ContactLinks({
	lead,
	reveal = false,
}: {
	lead: Lead;
	reveal?: boolean;
}) {
	const { t } = useTranslation();
	const revealClass = reveal ? HOVER_REVEAL : undefined;
	return (
		<div className="flex items-center gap-0.5">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						asChild
						variant="ghost"
						size="icon-xs"
						className={revealClass}
					>
						<a href={telHref(lead.phone)} aria-label={t("leads.call")}>
							<Phone />
						</a>
					</Button>
				</TooltipTrigger>
				<TooltipContent>{t("leads.call")}</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						asChild
						variant="ghost"
						size="icon-xs"
						className={revealClass}
					>
						<a
							href={waHref(lead.phone)}
							target="_blank"
							rel="noreferrer"
							aria-label={t("leads.whatsapp")}
						>
							<MessageCircle />
						</a>
					</Button>
				</TooltipTrigger>
				<TooltipContent>{t("leads.whatsapp")}</TooltipContent>
			</Tooltip>
		</div>
	);
}

const COUNTER_SKELETON_KEYS = ["today", "week", "total", "rate"];
const ROW_SKELETON_KEYS = ["a", "b", "c", "d", "e", "f"];

function LeadsSkeleton() {
	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-2">
					<Skeleton className="h-6 w-28" />
					<Skeleton className="h-3 w-44" />
				</div>
				<Skeleton className="h-8 w-28" />
			</div>
			<div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
				{COUNTER_SKELETON_KEYS.map((key) => (
					<Skeleton key={key} className="h-[92px] rounded-xl" />
				))}
			</div>
			<div className="mt-4 space-y-2">
				{ROW_SKELETON_KEYS.map((key) => (
					<Skeleton key={key} className="h-12 rounded-xl" />
				))}
			</div>
		</div>
	);
}

export function LeadsTab() {
	const { t, locale } = useTranslation();
	const dictionary = useDictionary();
	const { projectId, projectPending, setTab } = useWorkspace();

	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
	const [cursorHistory, setCursorHistory] = useState<string[]>([]);
	const [isExporting, setIsExporting] = useState(false);
	const deferredSearch = useDeferredValue(search.trim());
	const searchPending = search.trim() !== deferredSearch;
	const cursor = searchPending ? undefined : cursorHistory.at(-1);
	const listQuery = useMemo<LeadsQuery>(
		() => ({
			cursor,
			pageSize: LEADS_PAGE_SIZE,
			q: deferredSearch || undefined,
			status: statusFilter === "all" ? undefined : statusFilter,
		}),
		[cursor, deferredSearch, statusFilter],
	);
	const leadsQuery = useLeadsQuery(projectId, listQuery);
	const response = leadsQuery.data;
	const leads = response?.leads ?? [];
	const matchingTotal = response?.total ?? 0;
	const currentPage = cursorHistory.length + 1;
	const from = cursorHistory.length * LEADS_PAGE_SIZE;

	const handleSearchChange = (value: string) => {
		setSearch(value);
		setCursorHistory([]);
	};

	const handleStatusChange = (value: string) => {
		setStatusFilter(value as LeadStatus | "all");
		setCursorHistory([]);
	};

	const handleClearFilters = () => {
		setSearch("");
		setStatusFilter("all");
		setCursorHistory([]);
	};

	const handleExport = async () => {
		if (matchingTotal === 0 || isExporting) return;
		setIsExporting(true);
		try {
			const exportLeads = await listAllLeads(projectId, {
				q: search.trim() || undefined,
				status: statusFilter === "all" ? undefined : statusFilter,
			});
			downloadTextFile(
				`leads-${projectId}.csv`,
				buildLeadsCsv(exportLeads, dictionary.leads.csvHeaders),
			);
			toast.success(t("leads.exportedToast", { count: exportLeads.length }));
		} catch {
			toast.error("Could not export leads. Please try again.");
		} finally {
			setIsExporting(false);
		}
	};

	if (projectPending || leadsQuery.isPending) {
		return (
			<div className="h-full overflow-y-auto">
				<LeadsSkeleton />
			</div>
		);
	}

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
				{/* Header: title + free note; sheet sync + CSV export on the right,
				    wrapping under the title on narrow screens. */}
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 className="font-display font-semibold text-lg">
							{t("leads.title")}
						</h2>
						<p className="mt-0.5 text-muted-foreground text-xs">
							{t("leads.freeNote")}
						</p>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<SheetSyncButton />
						<Button
							variant="outline"
							size="sm"
							onClick={() => void handleExport()}
							disabled={matchingTotal === 0 || isExporting}
						>
							<Download />
							{t("leads.exportCsv")}
						</Button>
					</div>
				</div>

				{response?.totals.total === 0 ? (
					<Empty className="mt-5 rounded-xl border border-dashed">
						<EmptyHeader>
							<EmptyMedia variant="icon" className="rounded-xl">
								<Users />
							</EmptyMedia>
							<EmptyTitle className="font-display">
								{t("leads.emptyTitle")}
							</EmptyTitle>
							<EmptyDescription>{t("leads.emptyBody")}</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button variant="secondary" onClick={() => setTab("settings")}>
								{t("leads.emptyCta")}
							</Button>
						</EmptyContent>
					</Empty>
				) : (
					<>
						<div className="mt-5">
							{response ? <LeadsCounters totals={response.totals} /> : null}
						</div>

						{/* Toolbar: search + status filter */}
						<div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative w-full sm:max-w-xs">
								<Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={search}
									onChange={(e) => handleSearchChange(e.target.value)}
									placeholder={t("leads.searchPlaceholder")}
									className="ps-9"
								/>
							</div>
							<Select value={statusFilter} onValueChange={handleStatusChange}>
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
						</div>

						{matchingTotal === 0 ? (
							<Empty className="mt-4 rounded-xl border border-dashed">
								<EmptyHeader>
									<EmptyMedia variant="icon" className="rounded-xl">
										<SearchX />
									</EmptyMedia>
									<EmptyTitle className="font-display">
										{t("leads.noResultsTitle")}
									</EmptyTitle>
									<EmptyDescription>
										{t("leads.noResultsBody")}
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
												<TableHead>{t("leads.colLocation")}</TableHead>
												<TableHead>{t("leads.colSource")}</TableHead>
												<TableHead>{t("leads.colDate")}</TableHead>
												<TableHead className="pe-4 text-end">
													{t("leads.colStatus")}
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
														<LeadOrderDetails extras={lead.extras} />
													</TableCell>
													<TableCell>
														<div className="flex items-center gap-1">
															<span className="font-mono text-xs">
																{formatPhone(lead.phone)}
															</span>
															<ContactLinks lead={lead} reveal />
														</div>
													</TableCell>
													<TableCell>
														<div className="text-sm">{lead.wilaya ?? "—"}</div>
														{lead.commune ? (
															<div className="text-muted-foreground text-xs">
																{lead.commune}
															</div>
														) : null}
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
													<TableCell className="pe-4">
														<div className="flex justify-end">
															<LeadStatusSelect lead={lead} />
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
												<LeadStatusSelect lead={lead} />
											</div>
											<div className="mt-2 flex items-center justify-between gap-2">
												<span className="font-mono text-xs">
													{formatPhone(lead.phone)}
												</span>
												<ContactLinks lead={lead} />
											</div>
											<div className="mt-2 flex items-center justify-between gap-2">
												<span className="min-w-0 truncate text-muted-foreground text-xs">
													{[
														lead.wilaya,
														lead.commune,
														relativeTime(lead.createdAt),
													]
														.filter((part) => part !== null)
														.join(" · ")}
												</span>
												<LeadSourceBadge
													campaign={lead.campaign}
													source={lead.source}
												/>
											</div>
											<LeadOrderDetails extras={lead.extras} />
										</div>
									))}
								</div>

								{/* Pagination */}
								{cursorHistory.length > 0 || response?.nextCursor ? (
									<div className="mt-4 flex items-center justify-between gap-3">
										<span className="font-mono text-muted-foreground text-xs">
											{t("leads.pageInfo", {
												from: from + 1,
												to: Math.min(from + leads.length, matchingTotal),
												total: matchingTotal,
											})}
										</span>
										<div className="flex items-center gap-2">
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
														setCursorHistory((history) => [
															...history,
															nextCursor,
														]);
													}
												}}
											>
												{t("leads.next")}
											</Button>
										</div>
									</div>
								) : null}
							</>
						)}
					</>
				)}
			</div>
		</div>
	);
}
