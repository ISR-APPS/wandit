// Leads tab — the mini order-CRM: counters, search + status filter, a
// desktop table / mobile card list with call & WhatsApp shortcuts, inline
// status pipeline and CSV export, paginated client-side.

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
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { formatDate, useDictionary, useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import type { Lead, LeadStatus } from "../../api/dto";
import { useLeadsQuery } from "../../api/leads.queries";
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
import { LeadStatusSelect } from "./lead-status-select";
import { LeadsCounters } from "./leads-counters";

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
	const { projectId, project, projectPending, setTab } = useWorkspace();
	const leadsQuery = useLeadsQuery(projectId, project?.leadCount);

	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
	const [page, setPage] = useState(1);

	const leads = leadsQuery.data ?? [];

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		const digitsQuery = query.replace(/\D/g, "").replace(/^0/, "");
		return leads.filter((lead) => {
			if (statusFilter !== "all" && lead.status !== statusFilter) {
				return false;
			}
			if (!query) return true;
			if (lead.name.toLowerCase().includes(query)) return true;
			return (
				digitsQuery.length > 0 &&
				lead.phone.replace(/\D/g, "").includes(digitsQuery)
			);
		});
	}, [leads, search, statusFilter]);

	const pageCount = Math.max(1, Math.ceil(filtered.length / LEADS_PAGE_SIZE));
	const currentPage = Math.min(page, pageCount);
	const from = (currentPage - 1) * LEADS_PAGE_SIZE;
	const pageLeads = filtered.slice(from, from + LEADS_PAGE_SIZE);

	const handleSearchChange = (value: string) => {
		setSearch(value);
		setPage(1);
	};

	const handleStatusChange = (value: string) => {
		setStatusFilter(value as LeadStatus | "all");
		setPage(1);
	};

	const handleClearFilters = () => {
		setSearch("");
		setStatusFilter("all");
		setPage(1);
	};

	const handleExport = () => {
		if (filtered.length === 0) return;
		downloadTextFile(
			`leads-${projectId}.csv`,
			buildLeadsCsv(filtered, dictionary.leads.csvHeaders),
		);
		toast.success(t("leads.exportedToast", { count: filtered.length }));
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
				{/* Header: title + free note, CSV export on the right */}
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="font-display font-semibold text-lg">
							{t("leads.title")}
						</h2>
						<p className="mt-0.5 text-muted-foreground text-xs">
							{t("leads.freeNote")}
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleExport}
						disabled={filtered.length === 0}
					>
						<Download />
						{t("leads.exportCsv")}
					</Button>
				</div>

				{leads.length === 0 ? (
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
							<LeadsCounters leads={leads} />
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

						{filtered.length === 0 ? (
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
												<TableHead>{t("leads.colDate")}</TableHead>
												<TableHead className="pe-4 text-end">
													{t("leads.colStatus")}
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{pageLeads.map((lead) => (
												<TableRow key={lead.id} className="group/row">
													<TableCell className="ps-4">
														<div
															dir="auto"
															className="max-w-52 truncate font-medium"
														>
															{lead.name}
														</div>
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
														<div className="text-sm">{lead.wilaya}</div>
														<div className="text-muted-foreground text-xs">
															{lead.commune}
														</div>
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
									{pageLeads.map((lead) => (
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
											<div className="mt-2 text-muted-foreground text-xs">
												{lead.wilaya} · {lead.commune} ·{" "}
												{relativeTime(lead.createdAt)}
											</div>
										</div>
									))}
								</div>

								{/* Pagination */}
								{filtered.length > LEADS_PAGE_SIZE ? (
									<div className="mt-4 flex items-center justify-between gap-3">
										<span className="font-mono text-muted-foreground text-xs">
											{t("leads.pageInfo", {
												from: from + 1,
												to: Math.min(from + LEADS_PAGE_SIZE, filtered.length),
												total: filtered.length,
											})}
										</span>
										<div className="flex items-center gap-2">
											<Button
												variant="outline"
												size="sm"
												disabled={currentPage <= 1}
												onClick={() => setPage(currentPage - 1)}
											>
												{t("leads.previous")}
											</Button>
											<Button
												variant="outline"
												size="sm"
												disabled={currentPage >= pageCount}
												onClick={() => setPage(currentPage + 1)}
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
