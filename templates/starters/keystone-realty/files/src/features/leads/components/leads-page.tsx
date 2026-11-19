// The leads page behind login: the title with the period and the export;
// the answer target and three counts; the sources, the follow-ups, and the pipeline; then the table of every lead.
// The /app/leads route renders it after its loader. The route also uses the skeleton and the error below.
// The URL holds `status` (the status filter of the table) and `lead` (the open lead panel). The period is page state.
import {
	CalendarCheckIcon,
	DownloadSimpleIcon,
	HandshakeIcon,
	UserPlusIcon,
} from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	copyToClipboard,
	downloadCsv,
	fillMessage,
	formatRelativeTime,
	LEAD_SOURCES,
	LEAD_STATUSES,
	type LeadRow,
	type LeadSource,
	type LeadStatus,
	LeadStatusBadge,
	moneyFormat,
	PersonAvatar,
	toCsv,
} from "~/features/agency";
import { PageHeader } from "~/features/app-shell";
import { viewingsQueryOptions } from "~/features/viewings";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { RecordFilter, RecordTable } from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	LEADS_DEFAULT_DAYS,
	leadsQueryOptions,
	leadsSummaryQueryOptions,
} from "../api/leads.queries";
import { leadCsvColumns } from "../lib/lead-csv";
import { describeInterest } from "../lib/lead-interest";
import { buildFollowUps, type PeriodDays } from "../lib/lead-stats";
import { AnswerTargetCard } from "./answer-target-card";
import { FollowUpsCard } from "./follow-ups-card";
import { LeadKpiCard } from "./lead-kpi-card";
import { LeadSheet } from "./lead-sheet";
import { LeadSourcesCard } from "./lead-sources-card";
import { PeriodSelect } from "./period-select";
import { PipelineCard } from "./pipeline-card";

// Rows per page. Ten rows keep one page short enough to scan.
const PAGE_SIZE = 10;

type LeadsPageProps = {
	/** The lead id in the `lead` search param, for example "L-47703". undefined when no panel is open. */
	openLeadId: string | undefined;
	/** The status in the `status` search param. undefined shows every status. */
	statusFilter: LeadStatus | undefined;
};

/** The summary cards follow the period. The table always lists every lead, newest first. */
export function LeadsPage({ openLeadId, statusFilter }: LeadsPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: leads } = useSuspenseQuery(leadsQueryOptions());
	const { data: viewings } = useSuspenseQuery(viewingsQueryOptions());
	const [days, setDays] = useState<PeriodDays>(LEADS_DEFAULT_DAYS);
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...leadsSummaryQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const [source, setSource] = useState<LeadSource | null>(null);
	// The last open lead stays in the panel while it slides out. It is view state, not server data.
	const [shownLeadId, setShownLeadId] = useState(openLeadId);
	if (openLeadId !== undefined && openLeadId !== shownLeadId) {
		setShownLeadId(openLeadId);
	}
	const shownLead = leads.find((lead) => lead.id === shownLeadId);

	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const comparison = fillMessage(t("period.vsPrevious"), {
		period: dayCount.format(days),
	});
	const rows = leads.filter(
		(lead) =>
			(statusFilter === undefined || lead.status === statusFilter) &&
			(source === null || lead.source === source),
	);
	const setStatus = (status: LeadStatus | undefined) =>
		navigate({ to: "/app/leads", search: { status, lead: openLeadId } });

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("leads.title")}
				description={fillMessage(t("period.description"), {
					period: dayCount.format(days),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("common.exportCsv")}
							onClick={() =>
								downloadCsv("leads.csv", toCsv(rows, leadCsvColumns(t)))
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.exportCsv")}</span>
						</Button>
					</>
				}
			/>
			{summary.isError ? (
				<div className="grid justify-items-start gap-3 rounded-surface border p-6">
					<p className="text-sm" role="alert">
						{t("leads.summaryError")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => summary.refetch()}
					>
						{t("common.retry")}
					</Button>
				</div>
			) : summary.data === undefined ? (
				<SummarySkeleton />
			) : (
				<>
					<div className="grid @5xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
						<AnswerTargetCard
							share={summary.data.answerShare}
							answeredCount={summary.data.answeredCount}
						/>
						<LeadKpiCard
							label={t("leads.kpis.newLeads")}
							value={number.format(summary.data.newLeads.value)}
							change={summary.data.newLeads.change}
							comparison={comparison}
							icon={UserPlusIcon}
						/>
						<LeadKpiCard
							label={t("leads.kpis.viewingsHeld")}
							value={number.format(summary.data.viewingsHeld.value)}
							change={summary.data.viewingsHeld.change}
							comparison={comparison}
							icon={CalendarCheckIcon}
						/>
						<LeadKpiCard
							label={t("leads.kpis.offersMade")}
							value={number.format(summary.data.offersMade.value)}
							change={summary.data.offersMade.change}
							comparison={comparison}
							icon={HandshakeIcon}
						/>
					</div>
					{/* Two columns on a mid width: the donut beside the follow-ups, and the pipeline under both. */}
					<div className="grid @2xl/main:grid-cols-2 @5xl/main:grid-cols-3 gap-4">
						<LeadSourcesCard sources={summary.data.sources} days={days} />
						<FollowUpsCard
							followUps={buildFollowUps(leads, now)}
							now={now}
							statusFilter={statusFilter}
							onShowNew={() => setStatus("new")}
						/>
						<PipelineCard
							rows={summary.data.pipeline}
							activeStatus={statusFilter}
							onStatusChange={setStatus}
						/>
					</div>
				</>
			)}
			<Card>
				<CardHeader>
					<CardTitle>{t("leads.tableTitle")}</CardTitle>
				</CardHeader>
				<CardContent>
					<RecordTable<LeadRow>
						rows={rows}
						pageSize={PAGE_SIZE}
						selectable
						searchText={(row) =>
							`${row.fullName} ${row.email} ${row.phone} ${describeInterest(row, t)} ${row.agentName}`
						}
						searchPlaceholder={t("leads.searchPlaceholder")}
						noResults={t("leads.noResults")}
						toolbar={
							<>
								<RecordFilter
									label={t("leads.status")}
									options={LEAD_STATUSES.map((value) => ({
										value,
										label: t(`agency.leadStatuses.${value}`),
									}))}
									value={statusFilter ?? null}
									onValueChange={(value) =>
										setStatus(LEAD_STATUSES.find((option) => option === value))
									}
								/>
								<RecordFilter
									label={t("leads.source")}
									options={LEAD_SOURCES.map((value) => ({
										value,
										label: t(`agency.leadSources.${value}`),
									}))}
									value={source}
									onValueChange={(value) =>
										setSource(
											LEAD_SOURCES.find((option) => option === value) ?? null,
										)
									}
								/>
							</>
						}
						bulkActions={(selected) => (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-9"
								onClick={() =>
									downloadCsv(
										"leads-selected.csv",
										toCsv(selected, leadCsvColumns(t)),
									)
								}
							>
								<DownloadSimpleIcon />
								{t("table.exportSelected")}
							</Button>
						)}
						rowMenu={(row) => (
							<>
								<DropdownMenuItem asChild>
									<Link
										to="/app/leads"
										search={{ status: statusFilter, lead: row.id }}
									>
										{t("leads.openLead")}
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() =>
										copyToClipboard(row.email, {
											done: t("table.copied"),
											failed: t("table.copyFailed"),
										})
									}
								>
									{t("leads.copyEmail")}
								</DropdownMenuItem>
							</>
						)}
						columns={[
							{
								id: "lead",
								header: t("leads.lead"),
								sortValue: (row) => row.fullName,
								cell: (row) => (
									<div className="flex items-center gap-3">
										<PersonAvatar fullName={row.fullName} />
										<div className="grid min-w-48 justify-items-start gap-0.5">
											<Link
												to="/app/leads"
												search={{ status: statusFilter, lead: row.id }}
												className="truncate font-medium hover:underline"
												dir="auto"
											>
												{row.fullName}
											</Link>
											<span className="truncate text-muted-foreground text-xs">
												{row.email}
											</span>
										</div>
									</div>
								),
							},
							{
								id: "status",
								header: t("leads.status"),
								hideable: true,
								sortValue: (row) => LEAD_STATUSES.indexOf(row.status),
								cell: (row) => <LeadStatusBadge status={row.status} />,
							},
							{
								id: "source",
								header: t("leads.source"),
								hideable: true,
								sortValue: (row) => t(`agency.leadSources.${row.source}`),
								cell: (row) => t(`agency.leadSources.${row.source}`),
							},
							{
								id: "interest",
								header: t("leads.interest"),
								hideable: true,
								sortValue: (row) => describeInterest(row, t),
								cell: (row) =>
									row.listingId === null ? (
										describeInterest(row, t)
									) : (
										<Link
											to="/app/listings/$listingId"
											params={{ listingId: row.listingId }}
											className="hover:underline"
										>
											{describeInterest(row, t)}
										</Link>
									),
							},
							{
								id: "agent",
								header: t("leads.agent"),
								hideable: true,
								sortValue: (row) => row.agentName,
								cell: (row) => row.agentName,
							},
							{
								id: "received",
								header: t("leads.received"),
								hideable: true,
								sortValue: (row) => row.createdAt,
								cell: (row) => formatRelativeTime(row.createdAt, now, locale),
							},
							{
								id: "budget",
								header: t("leads.budget"),
								align: "end",
								hideable: true,
								sortValue: (row) => row.budget ?? 0,
								cell: (row) => (
									<span className="tabular-nums">
										{row.budget === null ? "–" : money.format(row.budget)}
									</span>
								),
							},
						]}
					/>
				</CardContent>
			</Card>
			<LeadSheet
				lead={shownLead}
				viewings={viewings.filter((viewing) => viewing.leadId === shownLeadId)}
				open={openLeadId !== undefined && shownLead?.id === openLeadId}
				onClose={() =>
					navigate({ to: "/app/leads", search: { status: statusFilter } })
				}
			/>
		</div>
	);
}

// Placeholder keys of the KPI row and the middle row. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];
const SKELETON_CARDS = ["1", "2", "3"];

// The KPI row and the middle row while the summary of a period loads.
function SummarySkeleton() {
	return (
		<>
			<div className="grid @5xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-36" />
				))}
			</div>
			<div className="grid @2xl/main:grid-cols-2 @5xl/main:grid-cols-3 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-96" />
				))}
			</div>
		</>
	);
}

/** Placeholder while the leads loader runs. The route sets it as pendingComponent. */
export function LeadsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<SummarySkeleton />
			<Skeleton className="h-160" />
		</div>
	);
}

/** Error state of the page when the loader fails. Try again runs the loader again. */
export function LeadsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("leads.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
