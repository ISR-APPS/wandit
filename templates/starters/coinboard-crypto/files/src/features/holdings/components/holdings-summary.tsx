// The totals strip of the Holdings page: the value, the cost basis, the profit, and the count of the shown positions.
// HoldingsPage renders it above the table and gives it the rows of the active account tab.
// So each total equals the sum of the rows that the table lists for that tab.
// A bar under the totals splits the whole portfolio value by account.
import type { ReactNode } from "react";
import {
	ACCOUNTS,
	type Account,
	ChangeText,
	changeRatio,
	moneyFormat,
	roundCents,
	shareFormat,
	signedMoneyFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import type { Position } from "../api/positions.queries";

// One fill per account, in the order of ACCOUNTS.
const ACCOUNT_FILLS = {
	vault: "bg-chart-1",
	staking: "bg-chart-2",
	trading: "bg-chart-3",
} satisfies Record<Account, string>;

type HoldingsSummaryProps = {
	/** The positions of the active account tab. The four totals sum them. */
	positions: Position[];
	/** Every position of the user. The account bar under the totals always shows the whole portfolio. */
	allPositions: Position[];
};

/** Four cells in one panel: 2 by 2 on a phone, one row from 48rem. */
export function HoldingsSummary({
	positions,
	allPositions,
}: HoldingsSummaryProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	// The rows hold cents. roundCents removes the float rest of the sums.
	const value = roundCents(positions.reduce((sum, row) => sum + row.value, 0));
	const cost = roundCents(
		positions.reduce((sum, row) => sum + row.costBasis, 0),
	);
	const profit = roundCents(value - cost);
	const profitRatio = changeRatio(value, cost);
	const share = shareFormat(locale);
	const allValue = allPositions.reduce((sum, row) => sum + row.value, 0);
	// The value of each account that holds an asset, for the split bar.
	const accounts = ACCOUNTS.map((account) => ({
		account,
		value: roundCents(
			allPositions
				.filter((row) => row.account === account)
				.reduce((sum, row) => sum + row.value, 0),
		),
	})).filter((row) => row.value > 0);

	return (
		<Card className="gap-0 py-0">
			<CardContent className="px-0">
				<dl className="grid @3xl/main:grid-cols-4 grid-cols-2">
					<SummaryCell label={t("holdings.totalValue")}>
						{money.format(value)}
					</SummaryCell>
					<SummaryCell label={t("holdings.totalCost")}>
						{money.format(cost)}
					</SummaryCell>
					<SummaryCell label={t("holdings.totalProfit")}>
						<span className="flex flex-wrap items-baseline gap-x-2">
							{/* dir="ltr" keeps the sign in front of the amount in an Arabic page. */}
							<bdi dir="ltr">{signedMoneyFormat(locale).format(profit)}</bdi>
							{profitRatio === null ? null : (
								<ChangeText
									change={profitRatio}
									className="font-medium font-sans text-sm"
								/>
							)}
						</span>
					</SummaryCell>
					<SummaryCell label={t("holdings.positions")}>
						{new Intl.NumberFormat(locale).format(positions.length)}
					</SummaryCell>
				</dl>
				{accounts.length === 0 ? null : (
					<div className="grid gap-3 border-t p-4 @3xl/main:px-6">
						<div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
							<span className="label-text text-muted-foreground">
								{t("holdings.accountsTitle")}
							</span>
							{accounts.map((row) => (
								<span key={row.account} className="flex items-center gap-2">
									<span
										aria-hidden="true"
										className={cn(
											"size-2.5 rounded-sm",
											ACCOUNT_FILLS[row.account],
										)}
									/>
									<span>{t(`ledger.accounts.${row.account}`)}</span>
									<span className="text-muted-foreground tabular-nums">
										{`${money.format(row.value)} · ${share.format(row.value / allValue)}`}
									</span>
								</span>
							))}
						</div>
						{/* The legend above repeats every value, so screen readers skip the bar. */}
						<div
							aria-hidden="true"
							className="flex h-2 gap-0.5 overflow-hidden rounded-sm bg-muted"
						>
							{accounts.map((row) => (
								<div
									key={row.account}
									className={cn(
										"h-full rounded-sm",
										ACCOUNT_FILLS[row.account],
									)}
									style={{ width: `${(row.value / allValue) * 100}%` }}
								/>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

type SummaryCellProps = {
	/** The name of the total, already translated. */
	label: string;
	/** The formatted total. */
	children: ReactNode;
};

// One cell of the strip. The rules between the cells follow the 2 and the 4 column layouts.
function SummaryCell({ label, children }: SummaryCellProps) {
	return (
		<div
			className={cn(
				"grid gap-1 border-t @3xl/main:border-t-0 @3xl/main:p-6 p-4",
				"@3xl/main:border-e @3xl/main:last:border-e-0 odd:border-e",
				"[&:nth-child(-n+2)]:border-t-0",
			)}
		>
			<dt className="label-text text-muted-foreground text-sm">{label}</dt>
			<dd className="font-numeric font-semibold @3xl/main:text-2xl text-xl tabular-nums">
				{children}
			</dd>
		</div>
	);
}
