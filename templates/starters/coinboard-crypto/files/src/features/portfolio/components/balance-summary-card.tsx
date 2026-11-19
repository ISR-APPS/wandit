// The balance card of the home: one tile per account with its value today, a line chart of the 3 accounts
// over about 7 months, and an Export button that downloads the chart points as CSV.
// PortfolioPage renders it beside the recent activity card. It reads accountBalancesQueryOptions from the cache.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import {
	ACCOUNTS,
	type Account,
	downloadCsv,
	moneyFormat,
	toCsv,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { ChartConfig } from "~/shared/ui/chart";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	accountBalancesQueryOptions,
	type BalancePoint,
} from "../api/portfolio.queries";

const BalanceChart = lazy(() => import("./balance-chart"));

/** One chart color per account. The tiles show the same color as a dot beside the account name. */
const ACCOUNT_DOT = {
	vault: "bg-chart-1",
	staking: "bg-chart-2",
	trading: "bg-chart-3",
} satisfies Record<Account, string>;

/** The tiles show the last point: the value of each account at the start of today. */
export function BalanceSummaryCard() {
	const { t, locale } = useT();
	const { data: points } = useSuspenseQuery(accountBalancesQueryOptions());
	const money = moneyFormat(locale);
	const latest = points.at(-1);
	const config = {
		vault: { label: t("ledger.accounts.vault"), color: "var(--chart-1)" },
		staking: { label: t("ledger.accounts.staking"), color: "var(--chart-2)" },
		trading: { label: t("ledger.accounts.trading"), color: "var(--chart-3)" },
	} satisfies ChartConfig;
	const summary = ACCOUNTS.map(
		(account) =>
			`${config[account].label}: ${money.format(latest?.[account] ?? 0)}`,
	).join(", ");

	function exportCsv() {
		const day = new Intl.DateTimeFormat("en-CA", { dateStyle: "short" });
		downloadCsv(
			"account-balances.csv",
			toCsv(
				points.map((point) => ({ ...point, id: String(point.time) })),
				[
					{
						header: t("portfolio.balanceDate"),
						// en-CA writes the ISO day YYYY-MM-DD, which every spreadsheet reads as a date.
						value: (point: BalancePoint) => day.format(point.time),
					},
					...ACCOUNTS.map((account) => ({
						header: config[account].label,
						value: (point: BalancePoint) => point[account].toFixed(2),
					})),
				],
			),
		);
	}

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("portfolio.balanceTitle")}</CardTitle>
				<CardAction>
					<Button
						variant="outline"
						aria-label={t("common.export")}
						onClick={exportCsv}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="mb-8 grid @4xl/main:max-w-(--breakpoint-sm) @xl/main:grid-cols-3 gap-4 text-sm">
					{ACCOUNTS.map((account) => (
						<div
							key={account}
							className="grid gap-2 rounded-md border bg-muted p-4"
						>
							<div className="flex items-center gap-2">
								<span
									aria-hidden="true"
									className={`size-3 shrink-0 rounded-full ${ACCOUNT_DOT[account]}`}
								/>
								<span className="truncate">{config[account].label}</span>
							</div>
							<p className="font-numeric font-semibold text-xl tabular-nums">
								{money.format(latest?.[account] ?? 0)}
							</p>
						</div>
					))}
				</div>
				<Suspense
					fallback={<Skeleton className="@4xl/main:h-88 h-64 w-full" />}
				>
					<BalanceChart points={points} config={config} label={summary} />
				</Suspense>
			</CardContent>
		</Card>
	);
}
