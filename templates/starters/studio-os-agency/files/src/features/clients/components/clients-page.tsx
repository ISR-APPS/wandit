// The client list behind login, on the anatomy of the kit users page: a header with one action,
// then a table toolbar (filter field, Relation, Industry, and Lead filters, columns menu), the table, and the pages.
// The /app/clients route renders it after its loader, and also uses the skeleton and the error below.
// A client name or the row menu opens the client sheet with its projects and invoices.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { invoicesQueryOptions } from "~/features/invoices";
import { projectsQueryOptions } from "~/features/projects";
import {
	CLIENT_RELATIONS,
	type ClientRelation,
	type ClientSummary,
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	PageError,
	PersonAvatar,
	RelationBadge,
	toCsv,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { clientsQueryOptions } from "../api/clients.queries";
import { ClientSheet } from "./client-sheet";

// A list page shows ten rows per page, as the kit users page does.
const CLIENTS_PAGE_SIZE = 10;

/** The list page. The three filters cut the rows; then RecordTable searches, sorts, selects, and pages them. */
export function ClientsPage() {
	const { t, locale } = useT();
	const { money } = useFormatters();
	const { data: clients } = useSuspenseQuery(clientsQueryOptions());
	const { data: projects } = useSuspenseQuery(projectsQueryOptions());
	const { data: invoices } = useSuspenseQuery(invoicesQueryOptions());
	const [relation, setRelation] = useState<string | null>(null);
	const [industry, setIndustry] = useState<string | null>(null);
	const [lead, setLead] = useState<string | null>(null);
	// The sheet keeps the last client while it slides out, so the panel never closes empty.
	const [openId, setOpenId] = useState<string | null>(null);
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	const rows = clients.filter(
		(client) =>
			(relation === null || client.relation === relation) &&
			(industry === null || client.industry === industry) &&
			(lead === null || client.leadId === lead),
	);
	const collator = new Intl.Collator(locale);
	const industryOptions = [...new Set(clients.map((client) => client.industry))]
		.map((value) => ({ value, label: t(`codes.industries.${value}`) }))
		.sort((first, second) => collator.compare(first.label, second.label));
	const leadOptions = [
		...new Map(clients.map((client) => [client.leadId, client.leadName])),
	]
		.map(([value, label]) => ({ value, label }))
		.sort((first, second) => collator.compare(first.label, second.label));

	function openClient(clientId: string) {
		setOpenId(clientId);
		setIsSheetOpen(true);
	}

	const csvColumns: CsvColumn<ClientSummary>[] = [
		{ header: t("clients.client"), value: (row) => row.name },
		{
			header: t("clients.industry"),
			value: (row) => t(`codes.industries.${row.industry}`),
		},
		{ header: t("clients.lead"), value: (row) => row.leadName },
		{
			header: t("clients.liveProjects"),
			value: (row) => String(row.liveProjects),
		},
		{ header: t("clients.billed"), value: (row) => String(row.billedLastYear) },
		{
			header: t("clients.outstanding"),
			value: (row) => String(row.outstanding),
		},
		{
			header: t("clients.relation"),
			value: (row) => t(`codes.relations.${row.relation}`),
		},
	];

	const columns: RecordColumn<ClientSummary>[] = [
		{
			id: "name",
			header: t("clients.client"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<button
					type="button"
					onClick={() => openClient(row.id)}
					className="flex items-center gap-3 text-start font-medium hover:underline"
				>
					<PersonAvatar name={row.name} className="size-8" />
					{row.name}
				</button>
			),
		},
		{
			id: "industry",
			header: t("clients.industry"),
			sortValue: (row) => t(`codes.industries.${row.industry}`),
			hideable: true,
			cell: (row) => t(`codes.industries.${row.industry}`),
		},
		{
			id: "lead",
			header: t("clients.lead"),
			sortValue: (row) => row.leadName,
			hideable: true,
			cell: (row) => row.leadName,
		},
		{
			id: "projects",
			header: t("clients.liveProjects"),
			sortValue: (row) => row.liveProjects,
			align: "end",
			hideable: true,
			cell: (row) => new Intl.NumberFormat(locale).format(row.liveProjects),
		},
		{
			id: "billed",
			header: t("clients.billed"),
			sortValue: (row) => row.billedLastYear,
			align: "end",
			hideable: true,
			cell: (row) => money(row.billedLastYear),
		},
		{
			id: "outstanding",
			header: t("clients.outstanding"),
			sortValue: (row) => row.outstanding,
			align: "end",
			hideable: true,
			cell: (row) => (
				<span className={row.overdue > 0 ? "text-destructive" : undefined}>
					{money(row.outstanding)}
				</span>
			),
		},
		{
			id: "relation",
			header: t("clients.relation"),
			sortValue: (row) => row.relation,
			hideable: true,
			cell: (row) => <RelationBadge relation={row.relation} />,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("clients.title")}
				description={t("clients.description")}
				actions={
					<Button
						onClick={() => downloadCsv("clients.csv", toCsv(rows, csvColumns))}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("clients.export")}</span>
					</Button>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) => `${row.name} ${row.leadName}`}
				searchPlaceholder={t("clients.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("clients.relation")}
							options={CLIENT_RELATIONS.map((value: ClientRelation) => ({
								value,
								label: t(`codes.relations.${value}`),
							}))}
							value={relation}
							onValueChange={setRelation}
						/>
						<RecordFilter
							label={t("clients.industry")}
							options={industryOptions}
							value={industry}
							onValueChange={setIndustry}
						/>
						<RecordFilter
							label={t("clients.lead")}
							options={leadOptions}
							value={lead}
							onValueChange={setLead}
						/>
					</>
				}
				selectable
				bulkActions={(selected) => (
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							downloadCsv("clients.csv", toCsv(selected, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem onSelect={() => openClient(row.id)}>
							{t("table.open")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.id, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("table.copyId")}
						</DropdownMenuItem>
					</>
				)}
				pageSize={CLIENTS_PAGE_SIZE}
				noResults={t("clients.noResults")}
			/>
			<ClientSheet
				client={clients.find((client) => client.id === openId) ?? null}
				open={isSheetOpen}
				projects={projects}
				invoices={invoices}
				onOpenChange={setIsSheetOpen}
			/>
		</div>
	);
}

/** Placeholder while the loader runs: the header, the toolbar, and the table. */
export function ClientsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full max-w-xl" />
			<Skeleton className="h-96 rounded-surface" />
		</div>
	);
}

/** Error state of the Clients page when the loader fails. Try again runs the loader again. */
export function ClientsPageError() {
	const { t } = useT();
	return <PageError message={t("clients.loadError")} />;
}
