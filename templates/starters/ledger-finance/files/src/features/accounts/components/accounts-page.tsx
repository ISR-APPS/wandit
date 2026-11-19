// The accounts page behind login, in the anatomy of the kit users list: the title and one primary action,
// then the table with its filter field, three filter buttons, the column menu, row checkboxes, row menus, and pages.
// The /app/accounts route renders it after its loader. The route also uses the skeleton and the error below.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type AccountType,
	copyToClipboard,
	dayFormat,
	dayToDate,
	downloadCsv,
	fillMessage,
	MoneyText,
	toCsv,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { RecordFilter, RecordTable } from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { accountsQueryOptions } from "../api/accounts.queries";
import { accountCsvColumns } from "../lib/account-csv";
import { ACCOUNT_TYPE_ICONS } from "../lib/account-icons";
import type { AccountSummary } from "../lib/account-summary";

// The account types, in the order of the Type filter.
const ACCOUNT_TYPES = [
	"checking",
	"savings",
	"credit_card",
	"cash",
] as const satisfies readonly AccountType[];

/** "pending": the bank did not confirm some entries yet. "clear": every entry is cleared or reconciled. */
type AccountState = "pending" | "clear";

function stateOf(account: AccountSummary): AccountState {
	return account.pendingCount > 0 ? "pending" : "clear";
}

/** The filters live in the page state. RecordTable gets the rows that pass them. */
export function AccountsPage() {
	const { t, locale } = useT();
	const { data } = useSuspenseQuery(accountsQueryOptions());
	const [type, setType] = useState<string | null>(null);
	const [bank, setBank] = useState<string | null>(null);
	const [state, setState] = useState<string | null>(null);
	const longDay = dayFormat(locale, "long");
	const number = new Intl.NumberFormat(locale);
	// The cash box has no bank. The filter lists each bank once.
	const banks = [
		...new Set(
			data.accounts.flatMap((account) =>
				account.institution ? [account.institution] : [],
			),
		),
	];
	const rows = data.accounts.filter(
		(account) =>
			(type === null || account.type === type) &&
			(bank === null || account.institution === bank) &&
			(state === null || stateOf(account) === state),
	);

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("accounts.title")}
				description={fillMessage(t("accounts.description"), {
					day: longDay.format(dayToDate(data.today)),
				})}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv(
								"accounts.csv",
								toCsv(data.accounts, accountCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<RecordTable<AccountSummary>
				rows={rows}
				columns={[
					{
						id: "name",
						header: t("accounts.name"),
						cell: (account) => {
							const Icon = ACCOUNT_TYPE_ICONS[account.type];
							return (
								<Link
									to="/app/accounts/$accountId"
									params={{ accountId: account.id }}
									className="flex items-center gap-4 font-medium hover:underline"
								>
									<span
										aria-hidden="true"
										className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
									>
										<Icon className="size-4" />
									</span>
									{account.name}
								</Link>
							);
						},
						sortValue: (account) => account.name,
					},
					{
						id: "type",
						header: t("accounts.type"),
						cell: (account) => t(`accountTypes.${account.type}`),
						sortValue: (account) => t(`accountTypes.${account.type}`),
						hideable: true,
					},
					{
						id: "bank",
						header: t("accounts.institution"),
						cell: (account) => account.institution ?? "–",
						sortValue: (account) => account.institution ?? "",
						hideable: true,
					},
					{
						id: "number",
						header: t("accounts.number"),
						cell: (account) =>
							account.numberEnding ? (
								<span className="font-numeric tabular-nums">
									{`•••• ${account.numberEnding}`}
								</span>
							) : (
								"–"
							),
						hideable: true,
					},
					{
						id: "reconciled",
						header: t("accounts.lastReconciled"),
						cell: (account) =>
							account.lastReconciledDay
								? longDay.format(dayToDate(account.lastReconciledDay))
								: t("accounts.never"),
						sortValue: (account) => account.lastReconciledDay ?? "",
						hideable: true,
					},
					{
						id: "status",
						header: t("accounts.status"),
						cell: (account) =>
							stateOf(account) === "pending" ? (
								<Badge variant="warning">
									{fillMessage(t("accounts.pendingCount"), {
										count: number.format(account.pendingCount),
									})}
								</Badge>
							) : (
								<Badge variant="success">{t("accounts.states.clear")}</Badge>
							),
						sortValue: (account) => account.pendingCount,
						hideable: true,
					},
					{
						id: "balance",
						header: t("accounts.balance"),
						cell: (account) => <MoneyText amountCents={account.balanceCents} />,
						sortValue: (account) => account.balanceCents,
						align: "end",
					},
				]}
				searchText={(account) =>
					`${account.name} ${account.institution ?? ""} ${account.numberEnding ?? ""}`
				}
				searchPlaceholder={t("accounts.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("accounts.type")}
							options={ACCOUNT_TYPES.map((value) => ({
								value,
								label: t(`accountTypes.${value}`),
							}))}
							value={type}
							onValueChange={setType}
						/>
						<RecordFilter
							label={t("accounts.institution")}
							options={banks.map((value) => ({ value, label: value }))}
							value={bank}
							onValueChange={setBank}
						/>
						<RecordFilter
							label={t("accounts.status")}
							options={[
								{ value: "pending", label: t("accounts.states.pending") },
								{ value: "clear", label: t("accounts.states.clear") },
							]}
							value={state}
							onValueChange={setState}
						/>
					</>
				}
				rowMenu={(account) => (
					<>
						<DropdownMenuItem asChild>
							<Link
								to="/app/accounts/$accountId"
								params={{ accountId: account.id }}
							>
								{t("accounts.open")}
							</Link>
						</DropdownMenuItem>
						{account.numberEnding ? (
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(account.numberEnding ?? "", {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("accounts.copyNumber")}
							</DropdownMenuItem>
						) : null}
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
				pageSize={10}
				noResults={t("accounts.noResults")}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5"];

/** Placeholder while the accounts loader runs. The route sets it as pendingComponent. */
export function AccountsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-64 max-w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full max-w-lg" />
			<div className="grid gap-px overflow-hidden rounded-md border">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-13 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state of the accounts pages when a loader fails. Try again runs the loader again. */
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
