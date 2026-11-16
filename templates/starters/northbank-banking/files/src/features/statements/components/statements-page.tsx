// The statements page: one panel per account, then every monthly statement in a table with account tabs.
// The /app/statements route renders it after its loader. The route also uses the skeleton and the error below.
// A click on an account panel and a click on its tab set the same filter.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ACCOUNT_IDS,
	type AccountId,
	accountOf,
	dayFormat,
	dayToDate,
	FilterTabs,
	MoneyText,
	monthFormat,
	useIsWideWindow,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { useSidebar } from "~/shared/ui/sidebar";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	accountSummariesQueryOptions,
	statementsQueryOptions,
} from "../api/statements.queries";
import type { Statement } from "../lib/statements";
import { AccountPanel } from "./account-panel";
import { StatementStatusBadge } from "./statement-status-badge";

/**
 * The page. The account filter applies to the table only; the panels always show the three accounts.
 * Under 80rem the table drops the status and the opening balance, and the account moves under the month.
 */
export function StatementsPage() {
	const { t, locale } = useT();
	const { data: accounts } = useSuspenseQuery(accountSummariesQueryOptions());
	const { data: statements } = useSuspenseQuery(statementsQueryOptions());
	const [accountId, setAccountId] = useState<AccountId | "all">("all");
	const { isMobile: isPhone } = useSidebar();
	const isWide = useIsWideWindow();

	const month = monthFormat(locale);
	const shortDay = dayFormat(locale);
	const rows =
		accountId === "all"
			? statements
			: statements.filter((statement) => statement.accountId === accountId);
	const money = (cents: number) => (
		<MoneyText amountCents={cents} withCents={false} />
	);

	const periodColumn: DataTableColumn<Statement> = {
		id: "period",
		header: t("statements.period"),
		sortValue: (row) => row.month,
		cell: (row) => (
			<div className="grid justify-items-start">
				<Link
					to="/app/statements/$statementId"
					params={{ statementId: row.id }}
					className="font-medium hover:underline"
				>
					{month.format(dayToDate(row.month))}
				</Link>
				<span className="text-muted-foreground text-xs tabular-nums">
					{isWide
						? `${shortDay.format(dayToDate(row.month))} – ${shortDay.format(dayToDate(row.endDay))}`
						: `${t(`accounts.${row.accountId}`)} ••${accountOf(row.accountId).numberEnding}`}
				</span>
			</div>
		),
	};
	const closingColumn: DataTableColumn<Statement> = {
		id: "closing",
		header: t("statements.closing"),
		align: "end",
		sortValue: (row) => row.closingCents,
		cell: (row) => (
			<MoneyText
				amountCents={row.closingCents}
				withCents={false}
				className="font-medium"
			/>
		),
	};
	const inColumn: DataTableColumn<Statement> = {
		id: "in",
		header: t("statements.moneyIn"),
		align: "end",
		sortValue: (row) => row.moneyInCents,
		cell: (row) => money(row.moneyInCents),
	};
	const outColumn: DataTableColumn<Statement> = {
		id: "out",
		header: t("statements.moneyOut"),
		align: "end",
		sortValue: (row) => row.moneyOutCents,
		cell: (row) => money(row.moneyOutCents),
	};
	const columns: DataTableColumn<Statement>[] = isPhone
		? [periodColumn, closingColumn]
		: !isWide
			? [periodColumn, inColumn, outColumn, closingColumn]
			: [
					periodColumn,
					{
						id: "account",
						header: t("transactions.account"),
						sortValue: (row) => ACCOUNT_IDS.indexOf(row.accountId),
						cell: (row) => (
							<span className="whitespace-nowrap">
								{t(`accounts.${row.accountId}`)}
								<span className="ms-1.5 text-muted-foreground tabular-nums">
									{`••${accountOf(row.accountId).numberEnding}`}
								</span>
							</span>
						),
					},
					{
						id: "status",
						header: t("transactions.status"),
						sortValue: (row) => row.status,
						cell: (row) => <StatementStatusBadge status={row.status} />,
					},
					{
						id: "opening",
						header: t("statements.opening"),
						align: "end",
						sortValue: (row) => row.openingCents,
						cell: (row) => money(row.openingCents),
					},
					inColumn,
					outColumn,
					closingColumn,
				];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("statements.title")}
				description={t("statements.description")}
			/>
			<div className="grid @2xl/main:grid-cols-3 gap-4">
				{accounts.map((summary) => (
					<AccountPanel
						key={summary.account.id}
						summary={summary}
						isSelected={accountId === summary.account.id}
						onSelect={() =>
							setAccountId(
								accountId === summary.account.id ? "all" : summary.account.id,
							)
						}
					/>
				))}
			</div>
			<Card>
				<CardHeader>
					<CardTitle>{t("statements.tableTitle")}</CardTitle>
					<CardDescription>{t("statements.tableDescription")}</CardDescription>
				</CardHeader>
				<CardContent className="max-md:px-3">
					<DataTable
						rows={rows}
						columns={columns}
						noResults={t("statements.noResults")}
						toolbar={
							<FilterTabs
								value={accountId}
								options={[
									{
										value: "all" as const,
										label: t("statements.allAccounts"),
										count: statements.length,
									},
									...ACCOUNT_IDS.map((id) => ({
										value: id,
										label: t(`accounts.${id}`),
										count: statements.filter(
											(statement) => statement.accountId === id,
										).length,
									})),
								]}
								onValueChange={setAccountId}
								label={t("transactions.account")}
							/>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_PANELS = ["1", "2", "3"];
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the statements loader runs. The route sets it as pendingComponent. */
export function StatementsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className="grid @2xl/main:grid-cols-3 gap-4">
				{SKELETON_PANELS.map((key) => (
					<Skeleton key={key} className="h-32" />
				))}
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-md" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-11 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the statement pages when a loader fails. Try again runs the loader again. */
export function StatementsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("statements.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
