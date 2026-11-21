// The client list behind login, built on the kit users page: the header with "Export CSV", then a RecordTable
// with a filter field, Type, Balance, and City filters, a column menu, sortable heads, checkboxes, and row menus.
// The /app/clients route renders it after its loader. The route also uses the skeleton and the error below.
// "Open" in a row menu opens the client sheet. The open client lives in the URL (?client=), so other pages link to it.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	Link,
	useNavigate,
	useRouter,
	useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	CURRENCY,
	copyToClipboard,
	downloadCsv,
	moneyFormat,
	PersonAvatar,
	toCsv,
} from "~/features/practice";
import { type TranslationKey, useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { clientsQueryOptions } from "../api/clients.queries";
import type { ClientSummary } from "../lib/client-joins";
import { ClientSheet } from "./client-sheet";

// Ten rows per page, as the kit users page shows.
const CLIENTS_PAGE_SIZE = 10;

/** The balance state of a client: "overdue" has money past its due date, "due" has an open balance only. */
type BalanceState = "overdue" | "due" | "settled";

const BALANCE_STATES: BalanceState[] = ["overdue", "due", "settled"];

function balanceStateOf(client: ClientSummary): BalanceState {
	return client.overdue > 0
		? "overdue"
		: client.outstanding > 0
			? "due"
			: "settled";
}

/** Badge variant per balance state. Overdue is the only red one. The word always shows. */
const BALANCE_BADGE = {
	overdue: "destructive",
	due: "warning",
	settled: "success",
} as const satisfies Record<BalanceState, string>;

/** The columns of the client CSV. Amounts stay plain numbers, so a spreadsheet can sum them. */
function clientCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<ClientSummary>[] {
	return [
		{ header: t("clients.client"), value: (client) => client.name },
		{
			header: t("clients.kind"),
			value: (client) => t(`clients.${client.kind}`),
		},
		{
			header: t("clients.contact"),
			value: (client) => client.contactName ?? "",
		},
		{ header: t("clients.email"), value: (client) => client.email },
		{ header: t("clients.phone"), value: (client) => client.phone },
		{ header: t("clients.city"), value: (client) => client.city },
		{
			header: t("clients.openMatters"),
			value: (client) => String(client.openMatterCount),
		},
		{
			header: `${t("clients.outstanding")} (${CURRENCY})`,
			value: (client) => String(client.outstanding),
		},
	];
}

/** The filters cut the rows; then RecordTable searches, sorts, and pages them. */
export function ClientsPage() {
	const { t, locale } = useT();
	const { data: clients } = useSuspenseQuery(clientsQueryOptions());
	const search = useSearch({ from: "/app/clients" });
	const navigate = useNavigate({ from: "/app/clients" });
	const [kind, setKind] = useState<string | null>(null);
	const [balance, setBalance] = useState<string | null>(null);
	const [city, setCity] = useState<string | null>(null);
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const cities = [...new Set(clients.map((client) => client.city))].sort(
		(first, second) => first.localeCompare(second, locale),
	);
	const rows = clients.filter(
		(client) =>
			(kind === null || client.kind === kind) &&
			(balance === null || balanceStateOf(client) === balance) &&
			(city === null || client.city === city),
	);
	const openSheet = (clientId: string) =>
		navigate({ search: { client: clientId } });

	const columns: RecordColumn<ClientSummary>[] = [
		{
			id: "name",
			header: t("clients.client"),
			sortValue: (client) => client.name,
			cell: (client) => (
				<Link
					to="/app/clients"
					search={{ client: client.id }}
					className="flex items-center gap-3 hover:underline"
				>
					<PersonAvatar name={client.name} />
					<span className="max-w-56 truncate font-medium" dir="auto">
						{client.name}
					</span>
				</Link>
			),
		},
		{
			id: "kind",
			header: t("clients.kind"),
			hideable: true,
			sortValue: (client) => client.kind,
			cell: (client) => t(`clients.${client.kind}`),
		},
		{
			id: "email",
			header: t("clients.email"),
			hideable: true,
			sortValue: (client) => client.email,
			cell: (client) => client.email,
		},
		{
			id: "city",
			header: t("clients.city"),
			hideable: true,
			sortValue: (client) => client.city,
			cell: (client) => client.city,
		},
		{
			id: "matters",
			header: t("clients.openMatters"),
			align: "end",
			hideable: true,
			sortValue: (client) => client.openMatterCount,
			cell: (client) => number.format(client.openMatterCount),
		},
		{
			id: "outstanding",
			header: t("clients.outstanding"),
			align: "end",
			hideable: true,
			sortValue: (client) => client.outstanding,
			cell: (client) => money.format(client.outstanding),
		},
		{
			id: "status",
			header: t("clients.balance"),
			hideable: true,
			sortValue: (client) => BALANCE_STATES.indexOf(balanceStateOf(client)),
			cell: (client) => {
				const state = balanceStateOf(client);
				return (
					<Badge variant={BALANCE_BADGE[state]}>
						{t(`clients.balanceStates.${state}`)}
					</Badge>
				);
			},
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("clients.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("clients.csv", toCsv(rows, clientCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(client) =>
					`${client.name} ${client.contactName ?? ""} ${client.email} ${client.city}`
				}
				searchPlaceholder={t("clients.filter")}
				pageSize={CLIENTS_PAGE_SIZE}
				noResults={t("clients.noResults")}
				selectable
				toolbar={
					<>
						<RecordFilter
							label={t("clients.kind")}
							options={(["organization", "individual"] as const).map(
								(value) => ({
									value,
									label: t(`clients.${value}`),
								}),
							)}
							value={kind}
							onValueChange={setKind}
						/>
						<RecordFilter
							label={t("clients.balance")}
							options={BALANCE_STATES.map((value) => ({
								value,
								label: t(`clients.balanceStates.${value}`),
							}))}
							value={balance}
							onValueChange={setBalance}
						/>
						<RecordFilter
							label={t("clients.city")}
							options={cities.map((value) => ({ value, label: value }))}
							value={city}
							onValueChange={setCity}
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
								"clients-selected.csv",
								toCsv(selected, clientCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(client) => (
					<>
						<DropdownMenuItem onSelect={() => openSheet(client.id)}>
							{t("table.open")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(client.email, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("clients.copyEmail")}
						</DropdownMenuItem>
					</>
				)}
			/>
			<ClientSheet
				clientId={search.client ?? null}
				onClose={() => navigate({ search: { client: undefined } })}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ClientsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-36" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full sm:max-w-xl" />
			<div className="grid gap-2 rounded-md border p-3">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-10 w-full" />
				))}
			</div>
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
