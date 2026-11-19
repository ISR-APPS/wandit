// The statements page, in the kit project list anatomy: the title and the export, account tabs,
// then one tile per month with the close day, a "money out of money in" bar, the closing balance, and the status.
// The /app/statements route renders it after its loader. The account tab is local state.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ACCOUNT_IDS,
	type AccountId,
	accountOf,
	type CsvColumn,
	centsToUnits,
	countLabel,
	dayFormat,
	daysBetween,
	dayToDate,
	downloadCsv,
	fillMessage,
	moneyFormat,
	monthEndOf,
	monthFormat,
	toCsv,
	todayIsoDay,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { statementsQueryOptions } from "../api/statements.queries";
import type { Statement } from "../lib/statements";
import { StatementStatusBadge } from "./statement-status-badge";

/** Six tiles per account: the open month and the 5 closed months before it. */
export function StatementsPage() {
	const { t, locale } = useT();
	const { data: statements } = useSuspenseQuery(statementsQueryOptions());
	const [accountId, setAccountId] = useState<AccountId>("operating");
	const money = moneyFormat(locale, 0);
	const month = monthFormat(locale);
	const longDay = dayFormat(locale, "long");
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const today = todayIsoDay();
	const account = accountOf(accountId);
	const accountName = `${t(`accounts.${accountId}`)} ••${account.numberEnding}`;
	const shown = statements.filter((item) => item.accountId === accountId);

	const csvColumns: CsvColumn<Statement>[] = [
		{ header: t("statements.period"), value: (row) => row.month.slice(0, 7) },
		{
			header: t("entries.account"),
			value: (row) => t(`accounts.${row.accountId}`),
		},
		{
			header: t("statements.opening"),
			value: (row) => centsToUnits(row.openingCents).toFixed(2),
		},
		{
			header: t("statements.moneyIn"),
			value: (row) => centsToUnits(row.moneyInCents).toFixed(2),
		},
		{
			header: t("statements.moneyOut"),
			value: (row) => centsToUnits(row.moneyOutCents).toFixed(2),
		},
		{
			header: t("statements.closing"),
			value: (row) => centsToUnits(row.closingCents).toFixed(2),
		},
		{
			header: t("statements.status"),
			value: (row) => t(`statements.statuses.${row.status}`),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("statements.title")}
				description={t("statements.description")}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv(
								`northbank-statements-${accountId}.csv`,
								toCsv(shown, csvColumns),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<Tabs
				value={accountId}
				onValueChange={(value) =>
					setAccountId(
						ACCOUNT_IDS.find((item) => item === value) ?? "operating",
					)
				}
			>
				<TabsList>
					{ACCOUNT_IDS.map((id) => (
						<TabsTrigger key={id} value={id}>
							{t(`accounts.${id}`)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<div className="grid @4xl/main:grid-cols-3 @5xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{shown.map((item) => {
					// Money out over money in. Above 100% the month ran down the balance; the bar stops full.
					const outShare =
						item.moneyInCents === 0
							? 0
							: item.moneyOutCents / item.moneyInCents;
					return (
						<Card key={item.id} className="gap-4">
							<CardHeader>
								<CardTitle className="font-display text-lg">
									<Link
										to="/app/statements/$statementId"
										params={{ statementId: item.id }}
										className="hover:underline"
									>
										{month.format(dayToDate(item.month))}
									</Link>
								</CardTitle>
								<CardDescription>{accountName}</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-4">
								<p className="text-muted-foreground text-sm">
									{fillMessage(
										t(
											item.status === "open"
												? "statements.toDate"
												: "statements.closedOn",
										),
										{
											day: longDay.format(dayToDate(item.endDay)),
											lines: countLabel(
												item.lineCount,
												t("statements.lineOne"),
												t("statements.lineOther"),
												locale,
											),
										},
									)}
								</p>
								<div className="grid gap-2">
									<div className="flex items-center justify-between gap-2 text-sm">
										<span>{t("statements.outOfIn")}</span>
										<span className="font-medium tabular-nums">
											{percent.format(outShare)}
										</span>
									</div>
									<Progress
										value={outShare * 100}
										aria-label={`${t("statements.outOfIn")}: ${percent.format(outShare)}`}
									/>
								</div>
							</CardContent>
							<CardFooter className="justify-between gap-2">
								<span className="grid">
									<span className="text-muted-foreground text-xs">
										{t(
											item.status === "open"
												? "statements.balance"
												: "statements.closing",
										)}
									</span>
									<span className="font-medium tabular-nums">
										{money.format(centsToUnits(item.closingCents))}
									</span>
								</span>
								<StatementStatusBadge
									status={item.status}
									daysLeft={daysBetween(today, monthEndOf(today))}
								/>
							</CardFooter>
						</Card>
					);
				})}
			</div>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function StatementsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-72 max-w-full" />
			<div className="grid @4xl/main:grid-cols-3 @5xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				<Skeleton className="h-56" />
				<Skeleton className="h-56" />
				<Skeleton className="h-56" />
				<Skeleton className="h-56" />
				<Skeleton className="h-56" />
				<Skeleton className="h-56" />
				<Skeleton className="h-56" />
				<Skeleton className="h-56" />
			</div>
		</div>
	);
}

/** Error state when a loader of the statements pages fails. Try again runs the loader again. */
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
