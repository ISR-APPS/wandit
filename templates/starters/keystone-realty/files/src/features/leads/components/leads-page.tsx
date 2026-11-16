// The leads page behind login: the open pipeline, the source breakdown, and the searchable table.
// The /app/leads route renders it after its loader. The route also uses the skeleton and the error below.
// The URL holds two parts of the state: `status` is the tab of the table, and `lead` opens the panel of one lead.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	fillMessage,
	formatRelativeTime,
	LateBadge,
	LEAD_SOURCES,
	LEAD_STATUSES,
	type LeadRow,
	type LeadSource,
	type LeadStatus,
	LeadStatusBadge,
	moneyFormat,
	PersonAvatar,
} from "~/features/agency";
import { PageHeader } from "~/features/app-shell";
import { viewingsQueryOptions } from "~/features/viewings";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { leadsQueryOptions } from "../api/leads.queries";
import { describeInterest } from "../lib/lead-interest";
import {
	buildAnswerStats,
	buildPipeline,
	buildSourceSlices,
} from "../lib/lead-stats";
import { LeadSheet } from "./lead-sheet";
import { PipelineCard } from "./pipeline-card";
import { SourcesCard } from "./sources-card";

// The value of the source filter that shows the leads of every source.
const ALL_SOURCES = "all";

// On a phone the status tabs scroll sideways. The end fades, so the user sees that more tabs follow.
// pe-12 lets the last tab leave the faded end when the strip is at the end of its scroll.
const SCROLL_TABS =
	"max-w-full overflow-x-auto max-sm:pe-12 max-sm:[mask-image:linear-gradient(to_right,var(--foreground)_80%,transparent)] max-sm:rtl:[mask-image:linear-gradient(to_left,var(--foreground)_80%,transparent)]";

// The columns hide by the width of the page panel, also when the sidebar closes.
// The numbers are the places of the columns in `columns` below. Keep them in that order.
// Under 36rem (a phone): the lead and the time stay. Under 56rem: the source and the agent hide.
const COLUMN_WIDTHS =
	"@max-xl/main:[&_:is(th,td):is(:nth-child(2),:nth-child(3))]:hidden @max-4xl/main:[&_:is(th,td):is(:nth-child(4),:nth-child(5))]:hidden";

type LeadsPageProps = {
	/** The lead id in the `lead` search param, for example "L-47703". undefined when no panel is open. */
	openLeadId: string | undefined;
	/** The status in the `status` search param. undefined shows the "All" tab. */
	statusFilter: LeadStatus | undefined;
};

/** The list page. The status tab and the source filter the rows; then DataTable searches, sorts, and pages them. */
export function LeadsPage({ openLeadId, statusFilter }: LeadsPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: leads } = useSuspenseQuery(leadsQueryOptions());
	const { data: viewings } = useSuspenseQuery(viewingsQueryOptions());
	const [source, setSource] = useState<LeadSource | typeof ALL_SOURCES>(
		ALL_SOURCES,
	);
	// The last open lead stays in the panel while it slides out. It is view state, not server data.
	const [shownLeadId, setShownLeadId] = useState(openLeadId);
	if (openLeadId !== undefined && openLeadId !== shownLeadId) {
		setShownLeadId(openLeadId);
	}
	const shownLead = leads.find((lead) => lead.id === shownLeadId);

	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const ofSource =
		source === ALL_SOURCES
			? leads
			: leads.filter((lead) => lead.source === source);
	// A tab shows only for a status that has rows.
	const tabs = LEAD_STATUSES.map((value) => ({
		value,
		count: ofSource.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	// The source filter can empty the chosen tab. Its tab then disappears, so the list shows all rows.
	const activeStatus =
		statusFilter !== undefined && tabs.some((tab) => tab.value === statusFilter)
			? statusFilter
			: "all";
	const rows =
		activeStatus === "all"
			? ofSource
			: ofSource.filter((row) => row.status === activeStatus);
	const setStatus = (status: LeadStatus | undefined) =>
		navigate({ to: "/app/leads", search: { status, lead: openLeadId } });

	// The status, plus the late mark of a lead that waits too long.
	const badgesOf = (row: LeadRow) => (
		<div className="flex items-center gap-1.5">
			<LeadStatusBadge status={row.status} />
			{row.isLate ? <LateBadge /> : null}
		</div>
	);

	const columns: DataTableColumn<LeadRow>[] = [
		{
			id: "lead",
			header: t("leads.lead"),
			sortValue: (row) => row.fullName,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<PersonAvatar fullName={row.fullName} />
					<div className="grid justify-items-start gap-0.5 whitespace-normal">
						<Link
							to="/app/leads"
							search={{ status: statusFilter, lead: row.id }}
							className="font-medium hover:underline"
							dir="auto"
						>
							{row.fullName}
						</Link>
						{/* On a phone the badges replace the email, which the panel of the lead shows. */}
						<div className="@xl/main:hidden">{badgesOf(row)}</div>
						<span className="@max-xl/main:hidden text-muted-foreground text-xs">
							{row.email}
						</span>
					</div>
				</div>
			),
		},
		// On a phone the status sits under the name, and the panel of the lead shows the interest.
		{
			id: "status",
			header: t("leads.status"),
			sortValue: (row) => LEAD_STATUSES.indexOf(row.status),
			cell: (row) => badgesOf(row),
		},
		{
			id: "interest",
			header: t("leads.interest"),
			sortValue: (row) => describeInterest(row, t),
			cell: (row) => (
				<div className="grid justify-items-start">
					{row.listingId === null ? (
						<span>{describeInterest(row, t)}</span>
					) : (
						<Link
							to="/app/listings/$listingId"
							params={{ listingId: row.listingId }}
							className="hover:underline"
						>
							{describeInterest(row, t)}
						</Link>
					)}
					<span className="text-muted-foreground text-xs">
						{row.budget === null
							? t(`leads.interests.${row.interest}`)
							: `${t(`leads.interests.${row.interest}`)} · ${fillMessage(
									t("leads.upTo"),
									{ amount: money.format(row.budget) },
								)}`}
					</span>
				</div>
			),
		},
		{
			id: "source",
			header: t("leads.source"),
			sortValue: (row) => t(`agency.leadSources.${row.source}`),
			cell: (row) => t(`agency.leadSources.${row.source}`),
		},
		{
			id: "agent",
			header: t("leads.agent"),
			sortValue: (row) => row.agentName,
			cell: (row) => (
				<div className="flex items-center gap-2">
					<PersonAvatar fullName={row.agentName} className="size-7" />
					<span>{row.agentName}</span>
				</div>
			),
		},
		// The time is the last column, at the end side, like every number column.
		{
			id: "received",
			header: t("leads.received"),
			align: "end",
			sortValue: (row) => Date.parse(row.createdAt),
			cell: (row) => formatRelativeTime(row.createdAt, now, locale),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("leads.title")}
				description={t("leads.description")}
			/>
			<div className="grid @4xl/main:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] grid-cols-1 gap-6">
				<PipelineCard
					stages={buildPipeline(ofSource)}
					stats={buildAnswerStats(ofSource, now)}
					activeStatus={statusFilter}
					onStatusChange={setStatus}
				/>
				<SourcesCard slices={buildSourceSlices(leads, now)} />
			</div>
			<Card>
				<CardContent className={COLUMN_WIDTHS}>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.fullName} ${row.email} ${row.phone} ${describeInterest(row, t)} ${row.agentName}`
						}
						noResults={t("leads.noResults")}
						toolbar={
							<>
								<Select
									value={source}
									onValueChange={(value) =>
										setSource(
											LEAD_SOURCES.find((option) => option === value) ??
												ALL_SOURCES,
										)
									}
								>
									<SelectTrigger
										className="w-40"
										aria-label={t("leads.source")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_SOURCES}>
											{t("leads.allSources")}
										</SelectItem>
										{LEAD_SOURCES.map((option) => (
											<SelectItem key={option} value={option}>
												{t(`agency.leadSources.${option}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Tabs
									value={activeStatus}
									onValueChange={(value) =>
										setStatus(LEAD_STATUSES.find((option) => option === value))
									}
									className={SCROLL_TABS}
								>
									<TabsList>
										<TabsTrigger value="all">
											{t("leads.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(ofSource.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger key={tab.value} value={tab.value}>
												{t(`agency.leadStatuses.${tab.value}`)}
												<span className="text-muted-foreground tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
							</>
						}
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

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function LeadsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className="grid @4xl/main:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] grid-cols-1 gap-6">
				<Skeleton className="h-80" />
				<Skeleton className="h-80" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list when the loader fails. Try again runs the loader again. */
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
