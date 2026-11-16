// The client list behind login: four figures, the relation tabs, and the searchable table.
// The /app/clients route renders it after its loader, and also uses the skeleton and the error below.
// A client name opens the client sheet with its projects and invoices.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { invoicesQueryOptions } from "~/features/invoices";
import { projectsQueryOptions } from "~/features/projects";
import {
	CLIENT_RELATIONS,
	type ClientRelation,
	type ClientSummary,
	type Figure,
	FigureBand,
	PageError,
	PersonAvatar,
	RelationBadge,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { useSidebar } from "~/shared/ui/sidebar";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { clientsQueryOptions } from "../api/clients.queries";
import { ClientSheet } from "./client-sheet";

/** The list page. The relation tab filters the rows; then DataTable searches, sorts, and pages them. */
export function ClientsPage() {
	const { t, locale } = useT();
	const format = useFormatters();
	const { data: clients } = useSuspenseQuery(clientsQueryOptions());
	const { data: projects } = useSuspenseQuery(projectsQueryOptions());
	const { data: invoices } = useSuspenseQuery(invoicesQueryOptions());
	// A phone shows the client and the outstanding money. The relation moves under the name.
	const { isMobile } = useSidebar();
	const [relation, setRelation] = useState<ClientRelation | "all">("all");
	// The sheet keeps the last client while it slides out, so the panel never closes empty.
	const [openId, setOpenId] = useState<string | null>(null);
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	const number = new Intl.NumberFormat(locale);
	const rows =
		relation === "all"
			? clients
			: clients.filter((client) => client.relation === relation);
	const countOf = (value: ClientRelation) =>
		clients.filter((client) => client.relation === value).length;
	const billed = clients.reduce(
		(sum, client) => sum + client.billedLastYear,
		0,
	);
	const figures: Figure[] = [
		{
			id: "active",
			label: t("clients.figures.active"),
			value: number.format(clients.length - countOf("dormant")),
		},
		{
			id: "retainers",
			label: t("clients.figures.retainers"),
			value: number.format(countOf("retainer")),
		},
		{
			id: "billed",
			label: t("clients.figures.billed"),
			value: format.compactMoney(billed),
		},
		{
			id: "top",
			label: t("clients.figures.topShare"),
			// The share of the largest client in the billing of the year: a concentration risk.
			value: format.percent(
				billed === 0
					? 0
					: Math.max(...clients.map((client) => client.billedLastYear)) /
							billed,
			),
		},
	];

	const columns: DataTableColumn<ClientSummary>[] = [
		{
			id: "client",
			header: t("clients.client"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="grid justify-items-start">
					<button
						type="button"
						onClick={() => {
							setOpenId(row.id);
							setIsSheetOpen(true);
						}}
						// min-h-11 gives the button a 44 px touch area on a phone.
						className="inline-flex min-h-11 items-center text-start font-medium hover:underline md:min-h-0"
					>
						{row.name}
					</button>
					<span className="text-muted-foreground text-xs">
						{t(`codes.industries.${row.industry}`)}
					</span>
					{isMobile ? (
						<span className="pt-1.5">
							<RelationBadge relation={row.relation} />
						</span>
					) : null}
				</div>
			),
		},
		{
			id: "outstanding",
			header: t("clients.outstanding"),
			align: "end",
			sortValue: (row) => row.outstanding,
			cell: (row) => (
				<div className="grid justify-items-end">
					<span
						className={cn(row.outstanding === 0 && "text-muted-foreground")}
					>
						{format.money(row.outstanding)}
					</span>
					{row.overdue > 0 ? (
						<span className="font-medium text-destructive text-xs">
							{t("clients.overdueAmount").replace(
								"{amount}",
								format.money(row.overdue),
							)}
						</span>
					) : null}
				</div>
			),
		},
		{
			id: "billed",
			header: t("clients.billed"),
			align: "end",
			sortValue: (row) => row.billedLastYear,
			cell: (row) => format.money(row.billedLastYear),
		},
		{
			id: "relation",
			header: t("clients.relation"),
			sortValue: (row) => CLIENT_RELATIONS.indexOf(row.relation),
			// The live count shares the relation cell, so the table fits a 1024 px screen.
			cell: (row) => (
				<div className="grid justify-items-start gap-1">
					<RelationBadge relation={row.relation} />
					{row.liveProjects > 0 ? (
						<span className="text-muted-foreground text-xs">
							{row.liveProjects === 1
								? t("clients.liveOne")
								: t("clients.liveMany").replace(
										"{count}",
										number.format(row.liveProjects),
									)}
						</span>
					) : null}
				</div>
			),
		},
		{
			id: "lead",
			header: t("clients.lead"),
			sortValue: (row) => row.leadName,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<PersonAvatar
						name={row.leadName}
						className="size-6 text-[0.625rem]"
					/>
					{row.leadName}
				</span>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("clients.title")}
				description={t("clients.description")}
			/>
			<FigureBand figures={figures} />
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={isMobile ? columns.slice(0, 2) : columns}
						searchText={(row) => `${row.name} ${row.leadName}`}
						noResults={t("clients.noResults")}
						toolbar={
							<Tabs
								value={relation}
								onValueChange={(value) =>
									setRelation(
										CLIENT_RELATIONS.find((option) => option === value) ??
											"all",
									)
								}
								className="max-w-full overflow-x-auto"
							>
								{/* A phone wraps the tabs onto two lines, so no tab is cut at the edge. */}
								<TabsList className="max-md:h-auto! max-md:flex-wrap max-md:justify-start max-md:*:flex-none">
									<TabsTrigger value="all">
										{t("clients.all")}
										<span className="tabular-nums opacity-60">
											{number.format(clients.length)}
										</span>
									</TabsTrigger>
									{CLIENT_RELATIONS.map((value) => (
										<TabsTrigger key={value} value={value}>
											{t(`codes.relations.${value}`)}
											<span className="tabular-nums opacity-60">
												{number.format(countOf(value))}
											</span>
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
						}
					/>
				</CardContent>
			</Card>
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

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ClientsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-36" />
				<Skeleton className="h-4 w-72" />
			</div>
			<Skeleton className="h-20 rounded-surface" />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-md" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list when the loader fails. Try again runs the loader again. */
export function ClientsPageError() {
	const { t } = useT();
	return <PageError message={t("clients.loadError")} />;
}
