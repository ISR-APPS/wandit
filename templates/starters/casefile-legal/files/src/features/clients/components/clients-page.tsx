// The client list behind login: the page header, the kind tabs, and the searchable table.
// The /app/clients route renders it after its loader. The route also uses the skeleton and the error below.
// A click on a client name opens its sheet. The open client lives in the URL (?client=), so other pages link to it.
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	Link,
	useNavigate,
	useRouter,
	useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { fillMessage, moneyFormat, PersonAvatar } from "~/features/practice";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { clientsQueryOptions } from "../api/clients.queries";
import type { ClientSummary } from "../lib/client-joins";
import { ClientSheet } from "./client-sheet";

// The tabs of the list. "balance" keeps the clients with an open balance.
const CLIENT_VIEWS = ["all", "organization", "individual", "balance"] as const;
type ClientView = (typeof CLIENT_VIEWS)[number];

const VIEW_LABEL = {
	all: "clients.all",
	organization: "clients.organizations",
	individual: "clients.individuals",
	balance: "clients.withBalance",
} as const satisfies Record<ClientView, string>;

function isInView(client: ClientSummary, view: ClientView): boolean {
	if (view === "balance") {
		return client.outstanding > 0;
	}
	return view === "all" || client.kind === view;
}

/** The list page. The tab filters the rows; then DataTable searches, sorts, and pages them. */
export function ClientsPage() {
	const { t, locale } = useT();
	const { data: clients } = useSuspenseQuery(clientsQueryOptions());
	const search = useSearch({ from: "/app/clients" });
	const navigate = useNavigate({ from: "/app/clients" });
	const [view, setView] = useState<ClientView>("all");
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		month: "short",
		year: "numeric",
	});
	const rows = clients.filter((client) => isInView(client, view));

	const columns: DataTableColumn<ClientSummary>[] = [
		{
			id: "client",
			header: t("clients.client"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="flex min-w-56 items-center gap-3">
					<PersonAvatar name={row.name} />
					<div className="grid justify-items-start">
						<Link
							to="/app/clients"
							search={{ client: row.id }}
							className="font-medium hover:underline"
							dir="auto"
						>
							{row.name}
						</Link>
						<span className="text-muted-foreground text-xs" dir="auto">
							{row.contactName ?? row.email}
						</span>
						{/* On a phone the money columns are off screen, so the open balance also shows here. */}
						{row.outstanding > 0 ? (
							<span
								className={
									row.overdue > 0
										? "@2xl/main:hidden font-medium text-destructive text-xs tabular-nums"
										: "@2xl/main:hidden font-medium text-xs tabular-nums"
								}
							>
								{fillMessage(t("clients.outstandingAmount"), {
									amount: money.format(row.outstanding),
								})}
							</span>
						) : null}
					</div>
				</div>
			),
		},
		{
			id: "kind",
			header: t("clients.kind"),
			sortValue: (row) => row.kind,
			cell: (row) => (
				<Badge variant={row.kind === "organization" ? "secondary" : "outline"}>
					{t(`clients.${row.kind}`)}
				</Badge>
			),
		},
		{
			id: "city",
			header: t("clients.city"),
			sortValue: (row) => row.city,
			cell: (row) => <bdi>{row.city}</bdi>,
		},
		{
			id: "open",
			header: t("clients.openMatters"),
			align: "end",
			sortValue: (row) => row.openMatterCount,
			cell: (row) => number.format(row.openMatterCount),
		},
		{
			id: "billed",
			header: t("clients.billed"),
			align: "end",
			sortValue: (row) => row.billed,
			cell: (row) => money.format(row.billed),
		},
		{
			id: "outstanding",
			header: t("clients.outstanding"),
			align: "end",
			sortValue: (row) => row.outstanding,
			cell: (row) => (
				<span className="grid justify-items-end">
					<span
						className={cn(row.outstanding === 0 && "text-muted-foreground")}
					>
						{money.format(row.outstanding)}
					</span>
					{row.overdue > 0 ? (
						<span className="whitespace-nowrap font-medium text-destructive text-xs">
							{fillMessage(t("clients.overdueAmount"), {
								amount: money.format(row.overdue),
							})}
						</span>
					) : null}
				</span>
			),
		},
		{
			id: "since",
			header: t("clients.since"),
			align: "end",
			// A client with no matter has no date and sorts first in the ascending order.
			sortValue: (row) => row.since ?? "",
			cell: (row) =>
				row.since ? (
					<span className="whitespace-nowrap">
						{date.format(new Date(row.since))}
					</span>
				) : (
					<span className="text-muted-foreground">–</span>
				),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("clients.title")}
				description={t("clients.description")}
			/>
			<Card>
				<CardContent>
					<DataTable
						key={view}
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.name} ${row.contactName ?? ""} ${row.email} ${row.city}`
						}
						noResults={t("clients.noResults")}
						toolbar={
							<Tabs
								value={view}
								onValueChange={(value) =>
									setView(
										CLIENT_VIEWS.find((option) => option === value) ?? "all",
									)
								}
								className="max-w-full overflow-x-auto"
							>
								<TabsList>
									{CLIENT_VIEWS.map((option) => (
										<TabsTrigger key={option} value={option}>
											{t(VIEW_LABEL[option])}
											<span className="text-muted-foreground tabular-nums">
												{number.format(
													clients.filter((client) => isInView(client, option))
														.length,
												)}
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
				clientId={search.client ?? null}
				onClose={() => navigate({ search: { client: undefined } })}
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
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xl" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the client list when the loader fails. Try again runs the loader again. */
export function ClientsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("clients.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
