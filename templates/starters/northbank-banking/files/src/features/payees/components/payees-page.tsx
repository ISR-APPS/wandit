// The payees page, in the kit user list anatomy: the title and the export, then one table with a filter field,
// Status, Group, and Method filters, a column menu, row checkboxes, a row menu, and pages.
// The /app/payees route renders it after its loader. The filters are local state; RecordTable holds the rest.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	centsToUnits,
	copyToClipboard,
	dayFormat,
	dayToDate,
	downloadCsv,
	initialsOf,
	moneyFormat,
	PAYEE_CATEGORIES,
	toCsv,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { payeesQueryOptions } from "../api/payees.queries";
import { PAYEE_STATUSES, type PayeeSummary } from "../lib/payee-summary";
import { PayeeStatusBadge } from "./payee-status-badge";

// The two transfer methods of a payee, in the order of the Method filter.
const PAYEE_METHODS = ["ach", "wire"] as const;

/** Every control works on the sample payees in the browser. */
export function PayeesPage() {
	const { t, locale } = useT();
	const { data: summaries } = useSuspenseQuery(payeesQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [category, setCategory] = useState<string | null>(null);
	const [method, setMethod] = useState<string | null>(null);
	const money = moneyFormat(locale, 0);
	const shortDay = dayFormat(locale);
	const rows = summaries
		.filter((row) => status === null || row.status === status)
		.filter((row) => category === null || row.payee.category === category)
		.filter((row) => method === null || row.payee.method === method);

	const columns: RecordColumn<PayeeSummary>[] = [
		{
			id: "name",
			header: t("payees.name"),
			cell: (row) => (
				<Link
					to="/app/payees/$payeeId"
					params={{ payeeId: row.id }}
					className="flex items-center gap-3"
				>
					<Avatar className="size-8">
						<AvatarFallback className="bg-muted text-xs">
							{initialsOf(row.payee.name)}
						</AvatarFallback>
					</Avatar>
					<span className="truncate font-medium hover:underline">
						{row.payee.name}
					</span>
				</Link>
			),
			sortValue: (row) => row.payee.name,
		},
		{
			id: "category",
			header: t("payees.category"),
			cell: (row) => t(`payees.categories.${row.payee.category}`),
			sortValue: (row) => t(`payees.categories.${row.payee.category}`),
			hideable: true,
		},
		{
			id: "method",
			header: t("payees.method"),
			cell: (row) => t(`methods.${row.payee.method}`),
			sortValue: (row) => row.payee.method,
			hideable: true,
		},
		{
			id: "bank",
			header: t("payees.bank"),
			cell: (row) => (
				<span className="text-muted-foreground">{row.payee.bankName}</span>
			),
			sortValue: (row) => row.payee.bankName,
			hideable: true,
		},
		{
			id: "lastPaid",
			header: t("payees.lastPaid"),
			cell: (row) => (
				<span className="text-muted-foreground tabular-nums">
					{row.lastPaidDay
						? shortDay.format(dayToDate(row.lastPaidDay))
						: t("payees.never")}
				</span>
			),
			sortValue: (row) => row.lastPaidDay ?? "",
			hideable: true,
		},
		{
			id: "paid",
			header: t("payees.paid"),
			cell: (row) => money.format(centsToUnits(row.paidCents)),
			sortValue: (row) => row.paidCents,
			align: "end",
		},
		{
			id: "status",
			header: t("payees.status"),
			cell: (row) => <PayeeStatusBadge status={row.status} />,
			sortValue: (row) => PAYEE_STATUSES.indexOf(row.status),
		},
	];

	const csvColumns: CsvColumn<PayeeSummary>[] = [
		{ header: t("payees.name"), value: (row) => row.payee.name },
		{
			header: t("payees.category"),
			value: (row) => t(`payees.categories.${row.payee.category}`),
		},
		{
			header: t("payees.method"),
			value: (row) => t(`methods.${row.payee.method}`),
		},
		{ header: t("payees.bank"), value: (row) => row.payee.bankName },
		{
			header: t("payees.accountNumber"),
			value: (row) => row.payee.accountEnding,
		},
		{ header: t("payees.lastPaid"), value: (row) => row.lastPaidDay ?? "" },
		{
			header: t("payees.paid"),
			value: (row) => centsToUnits(row.paidCents).toFixed(2),
		},
		{
			header: t("payees.status"),
			value: (row) => t(`payees.statuses.${row.status}`),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("payees.title")}
				description={t("payees.description")}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv("northbank-payees.csv", toCsv(rows, csvColumns))
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
				searchText={(row) =>
					`${row.payee.name} ${row.payee.note} ${row.payee.bankName}`
				}
				searchPlaceholder={t("payees.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("payees.status")}
							options={PAYEE_STATUSES.map((value) => ({
								value,
								label: t(`payees.statuses.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("payees.category")}
							options={PAYEE_CATEGORIES.map((value) => ({
								value,
								label: t(`payees.categories.${value}`),
							}))}
							value={category}
							onValueChange={setCategory}
						/>
						<RecordFilter
							label={t("payees.method")}
							options={PAYEE_METHODS.map((value) => ({
								value,
								label: t(`methods.${value}`),
							}))}
							value={method}
							onValueChange={setMethod}
						/>
					</>
				}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem asChild>
							<Link to="/app/payees/$payeeId" params={{ payeeId: row.id }}>
								{t("entries.openShort")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.payee.accountEnding, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("payees.copyAccount")}
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
								"northbank-payees-selected.csv",
								toCsv(selected, csvColumns),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={10}
				noResults={t("payees.noResults")}
			/>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function PayeesPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-96 max-w-full" />
			<Skeleton className="h-128" />
		</div>
	);
}

/** Error state when a loader of the payees pages fails. Try again runs the loader again. */
export function PayeesPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("payees.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
