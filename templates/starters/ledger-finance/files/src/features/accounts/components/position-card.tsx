// The top panel of the accounts page: the net position, the cash on hand, the card debt,
// and one bar that shows which account holds the cash.
// AccountsPage renders it with the position and the accounts of accountsQueryOptions.
import { ChangeLine, MoneyText } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Card } from "~/shared/ui/card";
import type { AccountSummary, Position } from "../lib/account-summary";

type PositionCardProps = {
	position: Position;
	/** Every account. The bar shows the accounts that hold cash: every account that is not a card. */
	accounts: AccountSummary[];
};

// The fill of each part of the bar, in the order of the accounts. The accounts page has at most 4 cash accounts.
const PART_FILLS = ["bg-chart-1", "bg-chart-2", "bg-chart-4", "bg-chart-3"];

/**
 * The three figures follow the KPI form "strip" of the app-dashboard skill: one panel, cells split by rules.
 * Each cell shows the label, the value, then the change in 30 days, as the totals of the home do.
 */
export function PositionCard({ position, accounts }: PositionCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const cashAccounts = accounts.filter(
		(account) => account.type !== "credit_card" && account.balanceCents > 0,
	);
	// A debt that falls is good news, so the card figure is green when it goes down.
	const figures = [
		{
			id: "net",
			label: t("accounts.netPosition"),
			cents: position.netCents,
			change: position.changes.net,
			goodWhen: "up",
		},
		{
			id: "cash",
			label: t("metrics.cashOnHand"),
			cents: position.cashOnHandCents,
			change: position.changes.cashOnHand,
			goodWhen: "up",
		},
		{
			id: "debt",
			label: t("metrics.cardDebt"),
			cents: position.cardDebtCents,
			change: position.changes.cardDebt,
			goodWhen: "down",
		},
	] as const;

	return (
		// py-0 and gap-0 replace the py-6 and gap-6 of the kit Card, so the cells touch the panel edges.
		<Card className="gap-0 overflow-hidden py-0">
			{/* Each cell draws its top and start rule. The 1 px shift and the panel clip hide the rules at the panel edge. */}
			<div className="-ms-px -mt-px grid @2xl/main:grid-cols-3 grid-cols-1">
				{figures.map((figure, index) => (
					<div
						key={figure.id}
						className="grid gap-1 border-s border-t px-6 py-5"
					>
						<p className="label-text text-muted-foreground text-sm">
							{figure.label}
						</p>
						<MoneyText
							amountCents={figure.cents}
							className={
								index === 0 ? "font-medium text-3xl" : "font-medium text-2xl"
							}
						/>
						<ChangeLine change={figure.change} goodWhen={figure.goodWhen} />
					</div>
				))}
			</div>
			<div className="grid gap-3 border-t px-6 py-5">
				<p className="label-text text-muted-foreground text-sm">
					{t("accounts.whereCashIs")}
				</p>
				{/* Decoration: the list under the bar gives each share as text. */}
				<div
					aria-hidden="true"
					className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
				>
					{cashAccounts.map((account, index) => (
						<span
							key={account.id}
							className={`h-full min-w-1 ${PART_FILLS[index % PART_FILLS.length]}`}
							style={{
								width: `${(account.balanceCents / position.cashOnHandCents) * 100}%`,
							}}
						/>
					))}
				</div>
				<ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
					{cashAccounts.map((account, index) => (
						<li key={account.id} className="flex items-center gap-2">
							<span
								aria-hidden="true"
								className={`size-2 rounded-full ${PART_FILLS[index % PART_FILLS.length]}`}
							/>
							<bdi>{account.name}</bdi>
							<span className="font-numeric text-muted-foreground tabular-nums">
								{percent.format(
									account.balanceCents / position.cashOnHandCents,
								)}
							</span>
						</li>
					))}
				</ul>
			</div>
		</Card>
	);
}
