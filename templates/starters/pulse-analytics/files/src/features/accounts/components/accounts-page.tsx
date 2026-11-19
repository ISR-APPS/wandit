// The account list behind login, in the anatomy of the kit user list: the title and the export button,
// then a filter field, three filter buttons (status, plan, region), the column menu, and the table with pages.
// The /app/accounts route renders it after its loader. The route also uses the skeleton and the error below.
// The filters are state of this page. RecordTable searches, sorts, selects, and pages the filtered rows.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	initialsOf,
	PLANS,
	REGIONS,
	toCsv,
} from "~/features/tracking";
import { type TranslationKey, useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { type Account, accountsQueryOptions } from "../api/accounts.queries";
import { ACCOUNT_STATUS_BADGE, ACCOUNT_STATUSES } from "../lib/account-status";

// The kit list shows 10 rows per page.
const PAGE_SIZE = 10;

// The CSV columns of the list. The export button and the bulk action use them.
function accountCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Account>[] {
	return [
		{ header: t("accounts.columns.account"), value: (row) => row.name },
		{ header: t("accounts.columns.industry"), value: (row) => row.industry },
		{
			header: t("accounts.columns.plan"),
			value: (row) => t(`plans.${row.plan}`),
		},
		{ header: t("accounts.columns.owner"), value: (row) => row.ownerEmail },
		{
			header: t("accounts.columns.region"),
			value: (row) => t(`regions.${row.region}`),
		},
		{
			header: t("accounts.columns.status"),
			value: (row) => t(`accounts.statuses.${row.status}`),
		},
		{
			header: t("accounts.columns.activeUsers"),
			value: (row) => String(row.activePeople),
		},
	];
}

/** The status filter holds the same accounts as the bell of the header when it is "At risk". */
export function AccountsPage() {
	const { t } = useT();
	const { data: accounts } = useSuspenseQuery(accountsQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [plan, setPlan] = useState<string | null>(null);
	const [region, setRegion] = useState<string | null>(null);
	const rows = accounts.filter(
		(account) =>
			(status === null || account.status === status) &&
			(plan === null || account.plan === plan) &&
			(region === null || account.region === region),
	);

	const columns: RecordColumn<Account>[] = [
		{
			id: "account",
			header: t("accounts.columns.account"),
			cell: (row) => (
				<Link
					to="/app/accounts/$accountId"
					params={{ accountId: row.id }}
					className="flex items-center gap-4 font-medium hover:underline"
				>
					<Avatar className="size-8">
						<AvatarFallback className="text-xs">
							{initialsOf(row.name)}
						</AvatarFallback>
					</Avatar>
					<span className="truncate">{row.name}</span>
				</Link>
			),
		},
		{
			id: "industry",
			header: t("accounts.columns.industry"),
			cell: (row) => row.industry,
			sortValue: (row) => row.industry,
			hideable: true,
		},
		{
			id: "plan",
			header: t("accounts.columns.plan"),
			cell: (row) => t(`plans.${row.plan}`),
			sortValue: (row) => PLANS.indexOf(row.plan),
			hideable: true,
		},
		{
			id: "owner",
			header: t("accounts.columns.owner"),
			cell: (row) => row.ownerEmail,
			sortValue: (row) => row.ownerEmail,
			hideable: true,
		},
		{
			id: "region",
			header: t("accounts.columns.region"),
			cell: (row) => t(`regions.${row.region}`),
			sortValue: (row) => t(`regions.${row.region}`),
			hideable: true,
		},
		{
			id: "status",
			header: t("accounts.columns.status"),
			cell: (row) => (
				<Badge variant={ACCOUNT_STATUS_BADGE[row.status]}>
					{t(`accounts.statuses.${row.status}`)}
				</Badge>
			),
			sortValue: (row) => ACCOUNT_STATUSES.indexOf(row.status),
			hideable: true,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("accounts.title")}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv("accounts.csv", toCsv(rows, accountCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) => `${row.name} ${row.domain} ${row.ownerEmail}`}
				searchPlaceholder={t("accounts.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("accounts.columns.status")}
							options={ACCOUNT_STATUSES.map((value) => ({
								value,
								label: t(`accounts.statuses.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("accounts.columns.plan")}
							options={PLANS.map((value) => ({
								value,
								label: t(`plans.${value}`),
							}))}
							value={plan}
							onValueChange={setPlan}
						/>
						<RecordFilter
							label={t("accounts.columns.region")}
							options={REGIONS.map((value) => ({
								value,
								label: t(`regions.${value}`),
							}))}
							value={region}
							onValueChange={setRegion}
						/>
					</>
				}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem asChild>
							<Link
								to="/app/accounts/$accountId"
								params={{ accountId: row.id }}
							>
								{t("accounts.open")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.ownerEmail, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("accounts.copyOwnerEmail")}
						</DropdownMenuItem>
					</>
				)}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"accounts-selected.csv",
								toCsv(selected, accountCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("accounts.noResults")}
			/>
		</div>
	);
}

// Placeholder keys of the rows. Fixed keys, because the skeleton never reorders.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function AccountsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-36" />
			</div>
			<Skeleton className="h-9 w-full sm:max-w-md" />
			<div className="grid gap-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-12 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state of the list and of the account page when a loader fails. Try again runs the loader again. */
export function AccountsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("accounts.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
